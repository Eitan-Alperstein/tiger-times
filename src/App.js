import React, { useState, useEffect, useRef } from 'react';
import { Search, LogOut, Menu, X, Send, Trash2, Edit2, Plus, BarChart3, Users, FileText, Heart, MessageCircle, Eye } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, addDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import './App.css';

// ============ FIREBASE CONFIG ============
const firebaseConfig = {
  apiKey: "AIzaSyAPxadhX3PQthIVGBLq72kDJueHW23S1v8",
  authDomain: "the-tiger-times-b34t.firebaseapp.com",
  projectId: "the-tiger-times-b34t",
  storageBucket: "the-tiger-times-b34t.appspot.com",
  messagingSenderId: "499558240849",
  appId: "1:499558240849:web:132c798df5392911375e70"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ============ IMAGE UTILITIES ============
const resizeImage = (file, maxWidth = 300, maxHeight = 200) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    
    img.src = URL.createObjectURL(file);
  });
};

const searchUnsplashImages = async (query) => {
  try {
    const response = await fetch(`https://pixabay.com/api/?key=9656065-a4094594c34f9ac14c7fc4c39&q=${encodeURIComponent(query)}&image_type=photo&per_page=12&safesearch=true`);
    const data = await response.json();
    return data.hits?.map(hit => ({
      urls: { small: hit.webformatURL, regular: hit.largeImageURL },
      alt_description: hit.tags
    })) || [];
  } catch (error) {
    console.error('Error searching images:', error);
    return [];
  }
};

const convertImageToBase64 = async (imageUrl) => {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = 300;
          canvas.height = 200;
          ctx.drawImage(img, 0, 0, 300, 200);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image:', error);
    return null;
  }
};

// ============ BAD WORDS FILTER ============
const BAD_WORDS = ['badword1', 'badword2', 'inappropriate', 'offensive'];

const filterBadWords = (text) => {
  let filtered = text;
  BAD_WORDS.forEach(word => {
    filtered = filtered.replace(new RegExp(word, 'gi'), '*'.repeat(word.length));
  });
  return filtered;
};

// ============ CHART COMPONENTS ============
const TopArticlesChart = () => {
  const [topArticles, setTopArticles] = useState([]);
  
  useEffect(() => {
    const fetchTopArticles = async () => {
      try {
        const articlesRef = collection(db, 'articles');
        const q = query(articlesRef, where('status', '==', 'published'));
        const articlesSnap = await getDocs(q);
        const articles = articlesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(a => (a.views || 0) > 0)
          .sort((a, b) => (b.views || 0) - (a.views || 0))
          .slice(0, 10);
        console.log('Top articles:', articles);
        setTopArticles(articles);
      } catch (error) {
        console.error('Error fetching top articles:', error);
      }
    };
    fetchTopArticles();
  }, []);
  
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f59e0b'];
  const maxViews = Math.max(...topArticles.map(a => a.views || 0), 1);
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-lg font-bold mb-4">Top Articles by Views</h3>
      <div className="space-y-3">
        {topArticles.map((article, i) => (
          <div key={article.id} className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              {article.image && (
                <img src={article.image} alt={article.title} className="w-8 h-8 object-cover rounded" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{article.title}</div>
                <div className="text-xs text-gray-500">{article.views || 0} views</div>
              </div>
            </div>
            <div className="flex items-center gap-2 w-32">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div 
                  className="h-2 rounded-full" 
                  style={{
                    backgroundColor: colors[i],
                    width: `${((article.views || 0) / maxViews) * 100}%`
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CategoryViewsChart = () => {
  const [categoryData, setCategoryData] = useState([]);
  
  useEffect(() => {
    const fetchCategoryData = async () => {
      try {
        const articlesRef = collection(db, 'articles');
        const q = query(articlesRef, where('status', '==', 'published'));
        const articlesSnap = await getDocs(q);
        const articles = articlesSnap.docs.map(d => d.data());
        
        const categoryViews = {};
        articles.forEach(article => {
          const category = article.category || 'Other';
          categoryViews[category] = (categoryViews[category] || 0) + (article.views || 0);
        });
        
        const sortedCategories = Object.entries(categoryViews)
          .sort(([,a], [,b]) => b - a)
          .map(([category, views]) => ({ category, views }));
        
        setCategoryData(sortedCategories);
      } catch (error) {
        console.error('Error fetching category data:', error);
      }
    };
    fetchCategoryData();
  }, []);
  
  const colors = ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb'];
  const maxViews = Math.max(...categoryData.map(c => c.views), 1);
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-lg font-bold mb-4">Views by Category</h3>
      <div className="space-y-3">
        {categoryData.map((item, i) => (
          <div key={item.category} className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <div 
                className="w-4 h-4 rounded" 
                style={{ backgroundColor: colors[i % colors.length] }}
              />
              <div className="font-medium">{item.category}</div>
            </div>
            <div className="flex items-center gap-2 w-32">
              <div className="flex-1 bg-gray-200 rounded-full h-3">
                <div 
                  className="h-3 rounded-full" 
                  style={{
                    backgroundColor: colors[i % colors.length],
                    width: `${(item.views / maxViews) * 100}%`
                  }}
                />
              </div>
              <div className="text-sm font-medium w-12 text-right">{item.views}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const WriterPerformanceChart = () => {
  const [writerData, setWriterData] = useState([]);
  
  useEffect(() => {
    const fetchWriterData = async () => {
      try {
        const articlesRef = collection(db, 'articles');
        const q = query(articlesRef, where('status', '==', 'published'));
        const articlesSnap = await getDocs(q);
        const articles = articlesSnap.docs.map(d => d.data());
        
        const writerStats = {};
        for (const article of articles) {
          const authorId = article.authorId;
          if (!writerStats[authorId]) {
            const userDoc = await getDoc(doc(db, 'users', authorId));
            writerStats[authorId] = {
              name: userDoc.exists() ? userDoc.data().name : 'Unknown',
              articles: 0,
              totalViews: 0
            };
          }
          writerStats[authorId].articles++;
          writerStats[authorId].totalViews += article.views || 0;
        }
        
        const sortedWriters = Object.values(writerStats)
          .sort((a, b) => b.totalViews - a.totalViews)
          .slice(0, 5);
        
        setWriterData(sortedWriters);
      } catch (error) {
        console.error('Error fetching writer data:', error);
      }
    };
    fetchWriterData();
  }, []);
  
  const colors = ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb'];
  const maxViews = Math.max(...writerData.map(w => w.totalViews), 1);
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-lg font-bold mb-4">Top Writers by Views</h3>
      <div className="space-y-3">
        {writerData.map((writer, i) => (
          <div key={writer.name} className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-xs font-bold">
                {writer.name[0]}
              </div>
              <div>
                <div className="font-medium">{writer.name}</div>
                <div className="text-xs text-gray-500">{writer.articles} articles</div>
              </div>
            </div>
            <div className="flex items-center gap-2 w-32">
              <div className="flex-1 bg-gray-200 rounded-full h-3">
                <div 
                  className="h-3 rounded-full" 
                  style={{
                    backgroundColor: colors[i],
                    width: `${(writer.totalViews / maxViews) * 100}%`
                  }}
                />
              </div>
              <div className="text-sm font-medium w-12 text-right">{writer.totalViews}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PublishingTimelineChart = () => {
  const [timelineData, setTimelineData] = useState([]);
  
  useEffect(() => {
    const fetchTimelineData = async () => {
      try {
        const articlesRef = collection(db, 'articles');
        const q = query(articlesRef, where('status', '==', 'published'));
        const articlesSnap = await getDocs(q);
        const articles = articlesSnap.docs.map(d => d.data());
        
        const dailyCount = {};
        articles.forEach(article => {
          const date = article.createdAt?.toDate?.()?.toDateString() || 'Unknown';
          dailyCount[date] = (dailyCount[date] || 0) + 1;
        });
        
        const sortedDates = Object.entries(dailyCount)
          .sort(([a], [b]) => new Date(a) - new Date(b))
          .slice(-7)
          .map(([date, count]) => ({ date: new Date(date).toLocaleDateString(), count }));
        
        setTimelineData(sortedDates);
      } catch (error) {
        console.error('Error fetching timeline data:', error);
      }
    };
    fetchTimelineData();
  }, []);
  
  const maxCount = Math.max(...timelineData.map(d => d.count), 1);
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-lg font-bold mb-4">Publishing Timeline (Last 7 Days)</h3>
      <div className="space-y-2">
        {timelineData.map((day, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-20 text-xs text-gray-600">{day.date}</div>
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div 
                className="h-2 rounded-full bg-blue-500" 
                style={{ width: `${(day.count / maxCount) * 100}%` }}
              />
            </div>
            <div className="text-sm font-medium w-8 text-right">{day.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CommentEngagementChart = () => {
  const [engagementData, setEngagementData] = useState([]);
  
  useEffect(() => {
    const fetchEngagementData = async () => {
      try {
        const articlesRef = collection(db, 'articles');
        const q = query(articlesRef, where('status', '==', 'published'));
        const articlesSnap = await getDocs(q);
        
        const articleEngagement = [];
        for (const articleDoc of articlesSnap.docs) {
          const article = articleDoc.data();
          const commentsRef = collection(db, 'articles', articleDoc.id, 'comments');
          const commentsSnap = await getDocs(commentsRef);
          
          articleEngagement.push({
            title: article.title,
            comments: commentsSnap.size,
            views: article.views || 0
          });
        }
        
        const topEngagement = articleEngagement
          .sort((a, b) => b.comments - a.comments)
          .slice(0, 5);
        
        setEngagementData(topEngagement);
      } catch (error) {
        console.error('Error fetching engagement data:', error);
      }
    };
    fetchEngagementData();
  }, []);
  
  const maxComments = Math.max(...engagementData.map(a => a.comments), 1);
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-lg font-bold mb-4">Most Commented Articles</h3>
      <div className="space-y-3">
        {engagementData.map((article, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{article.title}</div>
              <div className="text-xs text-gray-500">{article.views} views</div>
            </div>
            <div className="flex items-center gap-2 w-24">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div 
                  className="h-2 rounded-full bg-purple-500" 
                  style={{ width: `${(article.comments / maxComments) * 100}%` }}
                />
              </div>
              <div className="text-sm font-medium w-8 text-right">{article.comments}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CategoryAverageChart = () => {
  const [avgData, setAvgData] = useState([]);
  
  useEffect(() => {
    const fetchAvgData = async () => {
      try {
        const articlesRef = collection(db, 'articles');
        const q = query(articlesRef, where('status', '==', 'published'));
        const articlesSnap = await getDocs(q);
        const articles = articlesSnap.docs.map(d => d.data());
        
        const categoryStats = {};
        articles.forEach(article => {
          const category = article.category || 'Other';
          if (!categoryStats[category]) {
            categoryStats[category] = { totalViews: 0, count: 0 };
          }
          categoryStats[category].totalViews += article.views || 0;
          categoryStats[category].count++;
        });
        
        const avgByCategory = Object.entries(categoryStats)
          .map(([category, stats]) => ({
            category,
            avgViews: Math.round(stats.totalViews / stats.count)
          }))
          .sort((a, b) => b.avgViews - a.avgViews);
        
        setAvgData(avgByCategory);
      } catch (error) {
        console.error('Error fetching average data:', error);
      }
    };
    fetchAvgData();
  }, []);
  
  const colors = ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb'];
  const maxAvg = Math.max(...avgData.map(c => c.avgViews), 1);
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-lg font-bold mb-4">Average Views by Category</h3>
      <div className="space-y-3">
        {avgData.map((item, i) => (
          <div key={item.category} className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <div 
                className="w-4 h-4 rounded" 
                style={{ backgroundColor: colors[i % colors.length] }}
              />
              <div className="font-medium">{item.category}</div>
            </div>
            <div className="flex items-center gap-2 w-32">
              <div className="flex-1 bg-gray-200 rounded-full h-3">
                <div 
                  className="h-3 rounded-full" 
                  style={{
                    backgroundColor: colors[i % colors.length],
                    width: `${(item.avgViews / maxAvg) * 100}%`
                  }}
                />
              </div>
              <div className="text-sm font-medium w-12 text-right">{item.avgViews}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============ WIDGET COMPONENTS ============
const WeatherWidget = () => {
  const [weather, setWeather] = useState(null);
  
  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=39.7392&longitude=-104.9903&current_weather=true&temperature_unit=fahrenheit')
      .then(res => res.json())
      .then(data => setWeather(data.current_weather))
      .catch(() => setWeather({temperature: 72, weathercode: 0}));
  }, []);
  
  return (
    <div className="col-span-full bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 className="text-lg font-bold text-blue-800 mb-2">Weather - Denver</h3>
      <div className="flex items-center gap-4">
        <div className="text-3xl">{weather?.weathercode === 0 ? '☀️' : weather?.weathercode < 3 ? '⛅' : '🌧️'}</div>
        <div>
          <div className="text-xl font-bold">{weather?.temperature || 72}°F</div>
          <div className="text-sm text-gray-600">{weather?.weathercode === 0 ? 'Clear' : weather?.weathercode < 3 ? 'Partly Cloudy' : 'Rainy'}</div>
        </div>
      </div>
    </div>
  );
};

const StocksWidget = () => {
  const [stocks, setStocks] = useState([]);
  
  useEffect(() => {
    const mockStocks = [
      {symbol: 'AAPL', change: '+2.1%', color: 'text-green-600'},
      {symbol: 'GOOGL', change: '+1.8%', color: 'text-green-600'},
      {symbol: 'TSLA', change: '-0.5%', color: 'text-red-600'},
      {symbol: 'MSFT', change: '+0.9%', color: 'text-green-600'},
      {symbol: 'AMZN', change: '+1.2%', color: 'text-green-600'},
      {symbol: 'META', change: '-1.1%', color: 'text-red-600'},
      {symbol: 'NFLX', change: '+3.4%', color: 'text-green-600'},
      {symbol: 'NVDA', change: '+5.2%', color: 'text-green-600'},
      {symbol: 'AMD', change: '-0.8%', color: 'text-red-600'},
      {symbol: 'INTC', change: '+0.3%', color: 'text-green-600'},
      {symbol: 'CRM', change: '+2.7%', color: 'text-green-600'},
      {symbol: 'ORCL', change: '-0.2%', color: 'text-red-600'},
      {symbol: 'IBM', change: '+1.5%', color: 'text-green-600'},
      {symbol: 'ADBE', change: '+0.7%', color: 'text-green-600'},
      {symbol: 'PYPL', change: '-2.1%', color: 'text-red-600'}
    ];
    setStocks(mockStocks);
  }, []);
  
  return (
    <div className="col-span-full bg-green-50 border border-green-200 rounded-lg p-4 overflow-hidden flex items-center">
      <div className="relative w-full">
        <div className="flex gap-6 text-sm whitespace-nowrap animate-marquee">
          {stocks.concat(stocks).map((stock, i) => (
            <span key={i}>{stock.symbol} <span className={stock.color}>{stock.change}</span></span>
          ))}
        </div>
      </div>
    </div>
  );
};

const QuoteWidget = () => {
  const [quote, setQuote] = useState(null);
  
  useEffect(() => {
    fetch('https://api.quotable.io/random')
      .then(res => res.json())
      .then(data => setQuote(data))
      .catch(() => setQuote({content: 'The only way to do great work is to love what you do.', author: 'Steve Jobs'}));
  }, []);
  
  return (
    <div className="col-span-full bg-purple-50 border border-purple-200 rounded-lg p-4">
      <h3 className="text-lg font-bold text-purple-800 mb-2">Quote of the Day</h3>
      {quote ? (
        <>
          <blockquote className="text-lg italic text-gray-700">"{quote.content}"</blockquote>
          <cite className="text-sm text-gray-500 mt-2 block">— {quote.author}</cite>
        </>
      ) : (
        <div className="text-gray-500 italic">Loading quote...</div>
      )}
    </div>
  );
};

const WordWidget = () => {
  const [word, setWord] = useState(null);
  
  useEffect(() => {
    fetch('https://api.dictionaryapi.dev/api/v2/entries/en/serendipity')
      .then(res => res.json())
      .then(data => {
        const entry = data[0];
        setWord({
          word: entry.word,
          phonetic: entry.phonetic,
          partOfSpeech: entry.meanings[0]?.partOfSpeech,
          definition: entry.meanings[0]?.definitions[0]?.definition
        });
      })
      .catch(() => setWord({
        word: 'Serendipity',
        partOfSpeech: 'noun',
        definition: 'The occurrence of events by chance in a happy way.'
      }));
  }, []);
  
  return (
    <div className="col-span-full bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <h3 className="text-lg font-bold text-yellow-800 mb-2">Word of the Day</h3>
      <div className="flex gap-4">
        <div>
          <div className="text-xl font-bold text-gray-900">{word?.word}</div>
          <div className="text-sm text-gray-600 italic">{word?.partOfSpeech}</div>
        </div>
        <div className="text-sm text-gray-700">{word?.definition}</div>
      </div>
    </div>
  );
};

const SportsWidget = () => {
  const [scores, setScores] = useState([]);
  
  useEffect(() => {
    const mockScores = [
      { type: 'header', text: 'MLS' },
      { type: 'game', home: 'LAFC', homeScore: '2', away: 'Galaxy', awayScore: '1', homeColor: '#000000', awayColor: '#005DAA' },
      { type: 'game', home: 'Atlanta', homeScore: '1', away: 'Miami', awayScore: '0', homeColor: '#80001C', awayColor: '#F7B5CD' },
      { type: 'game', home: 'Seattle', homeScore: '3', away: 'Portland', awayScore: '2', homeColor: '#5D9732', awayColor: '#004225' },
      { type: 'header', text: 'MLB' },
      { type: 'game', home: 'Yankees', homeScore: '7', away: 'Red Sox', awayScore: '4', homeColor: '#132448', awayColor: '#BD3039' },
      { type: 'game', home: 'Dodgers', homeScore: '9', away: 'Padres', awayScore: '3', homeColor: '#005A9C', awayColor: '#2F241D' },
      { type: 'game', home: 'Astros', homeScore: '8', away: 'Angels', awayScore: '5', homeColor: '#002D62', awayColor: '#BA0021' },
      { type: 'header', text: 'NBA' },
      { type: 'game', home: 'Lakers', homeScore: '108', away: 'Warriors', awayScore: '102', homeColor: '#552583', awayColor: '#1D428A' },
      { type: 'game', home: 'Celtics', homeScore: '115', away: 'Heat', awayScore: '109', homeColor: '#007A33', awayColor: '#98002E' },
      { type: 'game', home: 'Knicks', homeScore: '98', away: 'Nets', awayScore: '95', homeColor: '#006BB6', awayColor: '#000000' }
    ];
    setScores(mockScores);
  }, []);
  
  return (
    <div className="col-span-full bg-red-50 border border-red-200 rounded-lg p-4 overflow-hidden">
      <h3 className="text-lg font-bold text-red-800 mb-2">Sports Ticker</h3>
      <div className="relative">
        <div className="flex gap-8 text-sm whitespace-nowrap animate-marquee">
          {scores.concat(scores).map((item, i) => (
            item.type === 'header' ? (
              <span key={i} className="font-bold text-red-800 bg-red-200 px-2 py-1 rounded uppercase tracking-wide">
                {item.text}
              </span>
            ) : (
              <div key={i} className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg shadow-sm border">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: item.homeColor}}></div>
                  <span className="font-semibold">{item.home}</span>
                </span>
                <span className="flex items-center gap-1 font-bold">
                  <span>{item.homeScore}</span>
                  <span className="text-gray-400">-</span>
                  <span>{item.awayScore}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="font-semibold">{item.away}</span>
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: item.awayColor}}></div>
                </span>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
};

// ============ RICH TEXT EDITOR ============
const RichTextEditor = ({ value, onChange }) => {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && value) {
      editorRef.current.innerHTML = value;
    }
  }, []);

  const execCommand = (command) => {
    document.execCommand(command, false, null);
    editorRef.current.focus();
    onChange(editorRef.current.innerHTML);
  };

  const handleInput = () => {
    onChange(editorRef.current.innerHTML);
  };

  return (
    <div className="border border-gray-300 rounded">
      <div className="border-b border-gray-300 p-2 bg-gray-50 flex gap-2">
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className="px-3 py-1 border border-gray-300 rounded bg-white hover:bg-gray-100 font-bold"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className="px-3 py-1 border border-gray-300 rounded bg-white hover:bg-gray-100 italic"
        >
          I
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="p-4 min-h-80 focus:outline-none"
        style={{ minHeight: '300px' }}
        suppressContentEditableWarning
      />
    </div>
  );
};

// ============ COMMENT REPLY COMPONENT ============
const CommentReply = ({ reply, replyAuthor, currentUser, onLike, onDelete, articleId, commentId }) => {
  const isLiked = reply.likes?.includes(currentUser?.id);

  return (
    <div className="ml-8 bg-gray-50 border border-gray-200 rounded-lg p-4 mt-2">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-semibold text-gray-900 text-sm">{replyAuthor?.name || 'Unknown'}</div>
          <div className="text-xs text-gray-500">{new Date(reply.createdAt?.toDate?.()).toLocaleDateString()}</div>
        </div>
      </div>
      <p className="text-gray-700 text-sm mb-3">{reply.text}</p>
      <div className="flex gap-4 text-xs">
        <button
          onClick={() => onLike(articleId, commentId, reply.id, isLiked)}
          className={`flex items-center gap-1 ${isLiked ? 'text-red-600' : 'text-gray-500 hover:text-red-600'}`}
          type="button"
        >
          <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} />
          {reply.likeCount || 0}
        </button>
        {currentUser && (currentUser.id === reply.userId || currentUser.role === 'admin' || currentUser.role === 'editor') && (
          <button
            onClick={() => onDelete(articleId, commentId, reply.id)}
            className="text-gray-500 hover:text-red-600"
            type="button"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
};

// ============ COMMENT THREAD COMPONENT ============
const CommentThread = ({ comment, commentAuthor, currentUser, articleId, onLike, onDelete, onReplyLike, onReplyDelete }) => {
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState([]);
  const [replyAuthors, setReplyAuthors] = useState({});
  const [newReply, setNewReply] = useState('');
  const isLiked = comment.likes?.includes(currentUser?.id);

  const handleReplyLike = async (articleId, commentId, replyId, isLiked) => {
    if (!currentUser) return;
    try {
      const replyRef = doc(db, 'articles', articleId, 'comments', commentId, 'replies', replyId);
      const reply = replies.find(r => r.id === replyId);
      const currentLikeCount = reply?.likeCount || 0;
      
      if (isLiked) {
        await updateDoc(replyRef, {
          likes: arrayRemove(currentUser.id),
          likeCount: Math.max(0, currentLikeCount - 1)
        });
      } else {
        await updateDoc(replyRef, {
          likes: arrayUnion(currentUser.id),
          likeCount: currentLikeCount + 1
        });
      }
      await fetchReplies();
    } catch (error) {
      console.error('Error liking reply:', error);
    }
  };

  useEffect(() => {
    fetchReplies();
  }, []);

  useEffect(() => {
    if (showReplies) {
      fetchReplies();
    }
  }, [showReplies]);

  const fetchReplies = async () => {
    try {
      const repliesRef = collection(db, 'articles', articleId, 'comments', comment.id, 'replies');
      const repliesSnap = await getDocs(repliesRef);
      const repliesData = repliesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setReplies(repliesData);

      for (const reply of repliesData) {
        const userDoc = await getDoc(doc(db, 'users', reply.userId));
        if (userDoc.exists()) {
          setReplyAuthors(prev => ({ ...prev, [reply.userId]: userDoc.data() }));
        }
      }
    } catch (error) {
      console.error('Error fetching replies:', error);
    }
  };

  const handleReplySubmit = async () => {
    if (!newReply.trim() || !currentUser) return;

    // Check if user already replied to this comment
    const userAlreadyReplied = replies.some(reply => reply.userId === currentUser.id);
    if (userAlreadyReplied) {
      alert('You can only reply once per comment');
      return;
    }

    try {
      const repliesRef = collection(db, 'articles', articleId, 'comments', comment.id, 'replies');
      await addDoc(repliesRef, {
        userId: currentUser.id,
        text: filterBadWords(newReply),
        createdAt: new Date(),
        likes: [],
        likeCount: 0
      });
      setNewReply('');
      await fetchReplies();
    } catch (error) {
      console.error('Error posting reply:', error);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-semibold text-gray-900">{commentAuthor?.name || 'Unknown'}</div>
          <div className="text-xs text-gray-500">{new Date(comment.createdAt?.toDate?.()).toLocaleDateString()}</div>
        </div>
      </div>
      <p className="text-gray-700 mb-3">{comment.text}</p>
      <div className="flex gap-4 text-sm mb-3">
        <button
          onClick={() => onLike(articleId, comment.id, isLiked)}
          className={`flex items-center gap-1 ${isLiked ? 'text-red-600' : 'text-gray-500 hover:text-red-600'}`}
          type="button"
        >
          <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
          {comment.likeCount || 0}
        </button>
        <button
          onClick={() => {
            setShowReplies(!showReplies);
            if (!showReplies) fetchReplies();
          }}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
          type="button"
        >
          <MessageCircle size={16} />
          {replies.length} Replies
        </button>
        {currentUser && (currentUser.id === comment.userId || currentUser.role === 'admin' || currentUser.role === 'editor') && (
          <button
            onClick={() => onDelete(articleId, comment.id)}
            className="text-gray-500 hover:text-red-600"
            type="button"
          >
            Delete
          </button>
        )}
      </div>

      {showReplies && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          {currentUser && !replies.some(reply => reply.userId === currentUser.id) && (
            <div className="mb-4">
              <textarea
                value={newReply}
                onChange={(e) => setNewReply(e.target.value)}
                placeholder="Reply to this comment..."
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-600 resize-none"
                rows="2"
              />
              <button
                onClick={handleReplySubmit}
                className="mt-2 bg-red-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-red-700 flex items-center gap-1"
                type="button"
              >
                <Send size={14} /> Reply
              </button>
            </div>
          )}
          {replies.map(reply => (
            <CommentReply
              key={reply.id}
              reply={reply}
              replyAuthor={replyAuthors[reply.userId]}
              currentUser={currentUser}
              onLike={handleReplyLike}
              onDelete={onReplyDelete}
              articleId={articleId}
              commentId={comment.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============ CATEGORY NAVIGATION ============
const CategoryNav = ({ setSearchTerm, setCurrentPage, currentUser, searchTerm }) => {
  const categories = ['News', 'Opinion', 'Arts', 'Sports', 'Features'];

  const handleWriteClick = () => {
    console.log('Write clicked');
    setCurrentPage('writer');
  };

  console.log('Current user role:', currentUser?.role);

  return (
    <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
      {categories.map(cat => (
        <button 
          key={cat} 
          onClick={() => { setSearchTerm(cat); setCurrentPage('home'); }} 
          className={`text-gray-100 hover:text-red-200 ${searchTerm === cat ? 'text-red-200 underline' : ''}`} 
          type="button"
        >
          {cat}
        </button>
      ))}
      {currentUser && currentUser.role === 'admin' && (
        <button onClick={() => setCurrentPage('admin')} className="text-gray-100 hover:text-red-200" type="button">Admin</button>
      )}
      {currentUser && (currentUser.role === 'writer' || currentUser.role === 'editor' || currentUser.role === 'admin') && (
        <button onClick={handleWriteClick} className="text-gray-100 hover:text-red-200 cursor-pointer z-10 relative" type="button">
          Write
        </button>
      )}
    </nav>
  );
};

const MobileCategoryNav = ({ setSearchTerm, setCurrentPage, setShowMobileMenu }) => {
  const categories = ['News', 'Opinion', 'Arts', 'Sports', 'Features'];

  return (
    <>
      {categories.map(cat => (
        <button key={cat} onClick={() => { setSearchTerm(cat); setCurrentPage('home'); setShowMobileMenu(false); }} className="block w-full text-left py-2 hover:text-red-200" type="button">{cat}</button>
      ))}
    </>
  );
};

// ============ ARTICLE CARD COMPONENT ============
const getCardSize = (article, index) => {
  const now = new Date();
  const articleDate = article.createdAt?.toDate?.() || new Date();
  const hoursOld = (now - articleDate) / (1000 * 60 * 60);
  const views = article.views || 0;
  
  // Hero card for first article
  if (index === 0) {
    return 'hero';
  }
  // Breaking news banner (reduced frequency)
  if (article.category === 'News' && hoursOld < 2 && views > 60 && index % 8 === 0) {
    return 'banner';
  }
  // Wide feature (reduced frequency)
  if (['Features', 'Arts'].includes(article.category) && views > 40 && index % 6 === 0) {
    return 'wide';
  }
  // Tall spotlight (reduced frequency)
  if (article.category === 'Opinion' && views > 30 && index % 7 === 0) {
    return 'tall';
  }
  // More tiny cards for gap filling
  if (index % 3 === 0 || (views < 10 && index % 4 === 0)) {
    return 'tiny';
  }
  // Medium cards for popular content
  if (views > 25 && hoursOld < 48) {
    return 'medium';
  }
  // Default to small cards
  return 'small';
};

const ArticleCard = ({ article, authorName, onRead, index }) => {
  const size = getCardSize(article, index);
  const sizeClasses = {
    hero: 'col-span-3 row-span-3',
    banner: 'col-span-4 row-span-1',
    wide: 'col-span-3 row-span-1',
    tall: 'col-span-1 row-span-2',
    compact: 'col-span-2 row-span-1',
    medium: 'col-span-2 row-span-1', 
    small: 'col-span-2 row-span-1',
    tiny: 'col-span-1 row-span-1'
  };
  
  if (size === 'hero') {
    return (
      <div onClick={() => onRead(article)} className={`bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition cursor-pointer ${sizeClasses[size]}`}>
        <div className="h-full flex flex-col">
          {article.image && <img src={article.image} alt={article.title} className="w-full h-48 object-cover" />}
          <div className="p-6 flex-1">
            <div className="text-sm font-semibold text-red-600 uppercase tracking-wide">{article.category}</div>
            <h3 className="text-2xl font-bold text-gray-900 mt-2 leading-tight line-clamp-4">{article.title}</h3>
            <div className="text-base text-gray-600 mt-4">By {authorName}</div>
            <div className="text-sm text-gray-400 mt-1">{new Date(article.createdAt?.toDate?.()).toLocaleDateString()}</div>
          </div>
        </div>
      </div>
    );
  }
  
  if (size === 'banner') {
    return (
      <div onClick={() => onRead(article)} className={`bg-red-600 text-white rounded-lg overflow-hidden hover:shadow-lg transition cursor-pointer ${sizeClasses[size]}`}>
        <div className="p-4 flex items-center gap-4">
          <div className="flex-1">
            <div className="text-xs font-semibold uppercase tracking-wide opacity-90">BREAKING • {article.category}</div>
            <h3 className="text-lg font-bold mt-1 line-clamp-2">{article.title}</h3>
          </div>
          {article.image && <img src={article.image} alt={article.title} className="w-16 h-16 object-cover rounded" />}
        </div>
      </div>
    );
  }
  
  if (size === 'compact') {
    return (
      <div onClick={() => onRead(article)} className={`bg-gray-50 border-l-4 border-red-600 hover:bg-gray-100 transition cursor-pointer ${sizeClasses[size]}`}>
        <div className="p-3 flex items-center gap-3">
          {article.image && <img src={article.image} alt={article.title} className="w-12 h-12 object-cover rounded" />}
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-3">{article.title}</h3>
            <div className="text-xs text-gray-500 mt-1">{new Date(article.createdAt?.toDate?.()).toLocaleDateString()}</div>
          </div>
        </div>
      </div>
    );
  }
  
  const imageClasses = {
    wide: article.image ? 'flex gap-4' : '',
    tall: article.image ? 'flex-col' : '',
    medium: article.image ? 'flex gap-4' : '',
    small: article.image ? 'flex gap-2' : '',
    tiny: ''
  };
  const imgSizes = {
    wide: 'w-32 h-full',
    tall: 'w-full h-24',
    medium: 'w-24 h-full', 
    small: 'w-16 h-full',
    tiny: ''
  };
  
  return (
    <div onClick={() => onRead(article)} className={`bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition cursor-pointer ${sizeClasses[size]}`}>
      <div className={`p-4 h-full ${imageClasses[size]} ${article.image && ['wide', 'medium', 'small'].includes(size) ? 'items-stretch' : ''}`}>
        {article.image && size !== 'tiny' && (
          <img 
            src={article.image} 
            alt={article.title}
            className={`${imgSizes[size]} object-cover rounded flex-shrink-0`}
          />
        )}
        <div className="flex-1">
          <div className={`text-xs font-semibold text-red-600 uppercase tracking-wide ${size === 'tall' ? 'mt-2' : ''}`}>{article.category}</div>
          <h3 className={`font-bold text-gray-900 mt-1 line-clamp-3 ${size === 'wide' ? 'text-lg' : size === 'tall' ? 'text-base' : size === 'medium' ? 'text-base' : size === 'tiny' ? 'text-xs' : 'text-base'}`}>{article.title}</h3>
          {size !== 'tiny' && <div className="text-sm text-gray-500 mt-2">By {authorName}</div>}
          <div className="text-xs text-gray-400 mt-1">{new Date(article.createdAt?.toDate?.()).toLocaleDateString()}</div>
        </div>
      </div>
    </div>
  );
};

// ============ SEARCH PAGE ============
const SearchPage = ({ setCurrentPage, setCurrentArticle, searchTerm, setSearchTerm }) => {
  const [articles, setArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [authorNames, setAuthorNames] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const articlesRef = collection(db, 'articles');
      const q = query(articlesRef, where('status', '==', 'published'), orderBy('createdAt', 'desc'));
      const articlesSnap = await getDocs(q);
      const articlesData = articlesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setArticles(articlesData);

      for (const article of articlesData) {
        const userDoc = await getDoc(doc(db, 'users', article.authorId));
        if (userDoc.exists()) {
          setAuthorNames(prev => ({ ...prev, [article.authorId]: userDoc.data().name }));
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching articles:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    const filtered = articles.filter(a =>
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (authorNames[a.authorId]?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredArticles(filtered);
  }, [searchTerm, articles, authorNames]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <button onClick={() => setCurrentPage('home')} className="text-red-600 hover:text-red-700 font-medium mb-6" type="button">← Back to Home</button>
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Search Articles</h1>
        <div className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <Search size={20} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search articles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent focus:outline-none text-lg"
            autoFocus
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading articles...</p>
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">{searchTerm ? 'No articles found' : 'Enter a search term to find articles'}</p>
        </div>
      ) : (
        <div>
          <p className="text-gray-600 mb-6">{filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''} found</p>
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4" style={{gridAutoRows: 'minmax(120px, max-content)'}}>
            {filteredArticles.map((article, index) => (
              <ArticleCard
                key={article.id}
                article={article}
                authorName={authorNames[article.authorId] || 'Unknown'}
                index={index}
                onRead={(article) => {
                  setCurrentArticle(article);
                  setCurrentPage('article');
                  window.history.pushState({}, '', `?article=${article.id}`);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============ HOME PAGE ============
const HomePage = ({ setCurrentPage, setCurrentArticle, searchTerm, setSearchTerm, showSunrise }) => {
  const [articles, setArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [authorNames, setAuthorNames] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const articlesRef = collection(db, 'articles');
      const q = query(articlesRef, where('status', '==', 'published'), orderBy('createdAt', 'desc'));
      const articlesSnap = await getDocs(q);
      const articlesData = articlesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setArticles(articlesData);

      for (const article of articlesData) {
        const userDoc = await getDoc(doc(db, 'users', article.authorId));
        if (userDoc.exists()) {
          setAuthorNames(prev => ({ ...prev, [article.authorId]: userDoc.data().name }));
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching articles:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    const filtered = articles.filter(a =>
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (authorNames[a.authorId]?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredArticles(filtered);
  }, [searchTerm, articles, authorNames]);

  const categories = [...new Set(articles.map(a => a.category))];

  return (
    <div>


      <div className="max-w-6xl mx-auto px-4 py-8">
        {loading && !showSunrise ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading articles...</p>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No articles found</p>
          </div>
        ) : (
          <>
            {/* Desktop Grid */}
            <div className="hidden md:grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4" style={{gridAutoRows: 'minmax(120px, max-content)'}}>
              {(() => {
              let currentRow = 0;
              let currentCol = 0;
              let articlesInSection = 0;
              let widgetCount = 0;
              
              return filteredArticles.map((article, index) => {
                const widgets = [];
                const size = getCardSize(article, index);
                const columnSpan = {
                  banner: 4, wide: 3, tall: 1, medium: 2, small: 2, tiny: 1
                }[size] || 2;
                
                if (currentCol + columnSpan > 6) {
                  currentCol = 0;
                  currentRow++;
                }
                
                if (currentRow >= 2 && articlesInSection > 0 && !searchTerm) {
                  const widgetType = widgetCount % 5;
                  widgetCount++;
                  currentRow = 0;
                  currentCol = 0;
                  articlesInSection = 0;
                
                if (widgetType === 0) {
                  widgets.push(
                    <WeatherWidget key={`weather-${index}`} />
                  );
                } else if (widgetType === 1) {
                  widgets.push(
                    <StocksWidget key={`stocks-${index}`} />
                  );
                } else if (widgetType === 2) {
                  widgets.push(
                    <QuoteWidget key={`quote-${index}`} />
                  );
                } else if (widgetType === 3) {
                  widgets.push(
                    <WordWidget key={`word-${index}`} />
                  );
                } else {
                  widgets.push(
                    <SportsWidget key={`sports-${index}`} />
                  );
                }
              }
              
              currentCol += columnSpan;
              articlesInSection++;
              
              return [
                ...widgets,
                <ArticleCard
                  key={article.id}
                  article={article}
                  authorName={authorNames[article.authorId] || 'Unknown'}
                  index={index}
                  onRead={(article) => {
                    setCurrentArticle(article);
                    setCurrentPage('article');
                    window.history.pushState({}, '', `?article=${article.id}`);
                  }}
                />
              ];
            }).flat()
          })()}
            </div>
            
            {/* Mobile List */}
            <div className="md:hidden px-4 space-y-4">
              {filteredArticles.map((article, index) => {
                const isLarge = index % 4 === 0;
                const isWide = index % 6 === 2;
                
                if (isLarge) {
                  return (
                    <div key={article.id} onClick={() => {
                      setCurrentArticle(article);
                      setCurrentPage('article');
                      window.history.pushState({}, '', `?article=${article.id}`);
                    }} className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer shadow-sm">
                      {article.image && (
                        <img src={article.image} alt={article.title} className="w-full h-48 object-cover rounded mb-3" />
                      )}
                      <div className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">{article.category}</div>
                      <h3 className="text-lg font-bold text-gray-900 line-clamp-3 leading-tight mb-2">{article.title}</h3>
                      <div className="text-xs text-gray-500">
                        By {authorNames[article.authorId] || 'Unknown'} • {new Date(article.createdAt?.toDate?.()).toLocaleDateString()}
                      </div>
                    </div>
                  );
                }
                
                if (isWide) {
                  return (
                    <div key={article.id} onClick={() => {
                      setCurrentArticle(article);
                      setCurrentPage('article');
                      window.history.pushState({}, '', `?article=${article.id}`);
                    }} className="bg-gray-50 border border-gray-200 rounded-lg p-4 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">{article.category}</div>
                          <h3 className="text-base font-bold text-gray-900 line-clamp-2">{article.title}</h3>
                        </div>
                        {article.image && (
                          <img src={article.image} alt={article.title} className="w-16 h-16 object-cover rounded flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div key={article.id} onClick={() => {
                    setCurrentArticle(article);
                    setCurrentPage('article');
                    window.history.pushState({}, '', `?article=${article.id}`);
                  }} className="bg-white border-b border-gray-200 pb-4 cursor-pointer">
                    <div className="flex gap-3">
                      {article.image && (
                        <img src={article.image} alt={article.title} className="w-20 h-20 object-cover rounded flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">{article.category}</div>
                        <h3 className="text-base font-bold text-gray-900 line-clamp-3 leading-tight mb-2">{article.title}</h3>
                        <div className="text-xs text-gray-500">
                          By {authorNames[article.authorId] || 'Unknown'} • {new Date(article.createdAt?.toDate?.()).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ============ ARTICLE PAGE ============
const ArticlePage = ({ article, setCurrentPage, currentUser }) => {
  const [comments, setComments] = useState([]);
  const [commentAuthors, setCommentAuthors] = useState({});
  const [newComment, setNewComment] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorBio, setAuthorBio] = useState('');

  useEffect(() => {
    fetchComments();
    fetchAuthor();
    incrementViewCount();
  }, [article]);

  const incrementViewCount = async () => {
    if (!currentUser) return;
    
    const viewKey = `viewed_${article.id}`;
    const hasViewed = localStorage.getItem(viewKey);
    
    if (!hasViewed) {
      try {
        await updateDoc(doc(db, 'articles', article.id), {
          views: (article.views || 0) + 1
        });
        localStorage.setItem(viewKey, 'true');
      } catch (error) {
        console.error('Error updating view count:', error);
      }
    }
  };

  const fetchComments = async () => {
    try {
      const commentsRef = collection(db, 'articles', article.id, 'comments');
      const q = query(commentsRef, orderBy('createdAt', 'desc'));
      const commentsSnap = await getDocs(q);
      const commentsData = commentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setComments(commentsData);

      for (const comment of commentsData) {
        const userDoc = await getDoc(doc(db, 'users', comment.userId));
        if (userDoc.exists()) {
          setCommentAuthors(prev => ({ ...prev, [comment.userId]: userDoc.data() }));
        }
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const fetchAuthor = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', article.authorId));
      if (userDoc.exists()) {
        setAuthorName(userDoc.data().name);
        setAuthorBio(userDoc.data().bio);
      }
    } catch (error) {
      console.error('Error fetching author:', error);
    }
  };

  const handleComment = async () => {
    if (!currentUser) {
      alert('Please log in to comment');
      return;
    }
    if (newComment.trim()) {
      try {
        const commentsRef = collection(db, 'articles', article.id, 'comments');
        await addDoc(commentsRef, {
          userId: currentUser.id,
          text: filterBadWords(newComment),
          createdAt: new Date(),
          likes: [],
          likeCount: 0
        });
        setNewComment('');
        await fetchComments();
      } catch (error) {
        console.error('Error posting comment:', error);
      }
    }
  };

  const handleCommentLike = async (articleId, commentId, isLiked) => {
    if (!currentUser) return;
    try {
      const commentRef = doc(db, 'articles', articleId, 'comments', commentId);
      if (isLiked) {
        await updateDoc(commentRef, {
          likes: arrayRemove(currentUser.id),
          likeCount: (comments.find(c => c.id === commentId)?.likeCount || 1) - 1
        });
      } else {
        await updateDoc(commentRef, {
          likes: arrayUnion(currentUser.id),
          likeCount: (comments.find(c => c.id === commentId)?.likeCount || 0) + 1
        });
      }
      await fetchComments();
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const handleCommentDelete = async (articleId, commentId) => {
    try {
      await deleteDoc(doc(db, 'articles', articleId, 'comments', commentId));
      await fetchComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };



  const handleReplyDelete = async (articleId, commentId, replyId) => {
    try {
      await deleteDoc(doc(db, 'articles', articleId, 'comments', commentId, 'replies', replyId));
    } catch (error) {
      console.error('Error deleting reply:', error);
    }
  };

  return (
    <div>
      <div className="bg-white border-b border-gray-200 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <button onClick={() => {
            setCurrentPage('home');
            window.history.pushState({}, '', window.location.pathname);
          }} className="text-red-600 hover:text-red-700 font-medium mb-4" type="button">← Back</button>
          <div className="text-xs font-semibold text-red-600 uppercase tracking-wide">{article.category}</div>
          <h1 className="text-5xl font-serif font-bold text-gray-900 mt-2">{article.title}</h1>
          <div className="flex items-center justify-between mt-4 text-gray-600">
            <div>
              <div className="font-semibold">{authorName}</div>
              <div className="text-sm text-gray-500">{new Date(article.createdAt?.toDate?.()).toLocaleDateString()}</div>
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Eye size={16} />
              {article.views || 0}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="prose prose-sm max-w-none mb-8" dangerouslySetInnerHTML={{ __html: article.content }} />

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white font-bold">{authorName[0]}</div>
            <div>
              <h3 className="font-semibold text-gray-900">{authorName}</h3>
              <p className="text-sm text-gray-600">{authorBio}</p>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Comments ({comments.length})</h2>

          {currentUser && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-600 resize-none"
                rows="3"
              />
              <button onClick={handleComment} className="mt-2 bg-red-600 text-white px-4 py-2 rounded font-medium hover:bg-red-700 flex items-center gap-2" type="button">
                <Send size={16} /> Comment
              </button>
            </div>
          )}

          <div className="space-y-4">
            {comments.map(comment => (
              <CommentThread
                key={comment.id}
                comment={comment}
                commentAuthor={commentAuthors[comment.userId]}
                currentUser={currentUser}
                articleId={article.id}
                onLike={handleCommentLike}
                onDelete={handleCommentDelete}
                onReplyLike={() => {}}
                onReplyDelete={handleReplyDelete}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ WRITER DASHBOARD ============
const WriterDashboard = ({ currentUser, setCurrentPage }) => {
  const [articles, setArticles] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ title: '', content: '', category: 'News', image: '' });
  const [imageSearch, setImageSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showImageSearch, setShowImageSearch] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArticles();
  }, [currentUser]);

  const fetchArticles = async () => {
    try {
      const articlesRef = collection(db, 'articles');
      const q = query(articlesRef, where('authorId', '==', currentUser.id), orderBy('createdAt', 'desc'));
      const articlesSnap = await getDocs(q);
      const articlesData = articlesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log('Writer articles:', articlesData);
      setArticles(articlesData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching articles:', error);
      setLoading(false);
    }
  };

  const handleNew = () => {
    setEditingId('new');
    setFormData({ title: '', content: '', category: 'News', image: '' });
    setShowImageSearch(false);
    setSearchResults([]);
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      alert('Title and content required');
      return;
    }

    try {
      if (editingId === 'new') {
        const articlesRef = collection(db, 'articles');
        await addDoc(articlesRef, {
          title: formData.title,
          content: formData.content,
          category: formData.category,
          image: formData.image,
          authorId: currentUser.id,
          status: 'pending_review',
          createdAt: new Date(),
          views: 0
        });
      } else {
        await updateDoc(doc(db, 'articles', editingId), {
          title: formData.title,
          content: formData.content,
          category: formData.category,
          image: formData.image,
          status: 'pending_review',
          revisionReason: null,
          updatedAt: new Date()
        });
      }
      setEditingId(null);
      setFormData({ title: '', content: '', category: 'News', image: '' });
      setShowImageSearch(false);
      setSearchResults([]);
      await fetchArticles();
    } catch (error) {
      console.error('Error saving article:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'articles', id));
      await fetchArticles();
    } catch (error) {
      console.error('Error deleting article:', error);
    }
  };

  if (loading) {
    return <div className="max-w-6xl mx-auto px-4 py-8"><p>Loading...</p></div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Writer Dashboard</h1>
        <button onClick={handleNew} className="bg-red-600 text-white px-4 py-2 rounded font-medium hover:bg-red-700 flex items-center gap-2" type="button">
          <Plus size={20} /> New Article
        </button>
      </div>

      {editingId && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Write Article</h2>
          <input
            type="text"
            placeholder="Article Title"
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:border-red-600"
          />
          <select
            value={formData.category}
            onChange={(e) => setFormData({...formData, category: e.target.value})}
            className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:border-red-600"
          >
            <option>News</option>
            <option>Sports</option>
            <option>Opinion</option>
            <option>Features</option>
            <option>Arts</option>
          </select>
          <RichTextEditor value={formData.content} onChange={(content) => setFormData({...formData, content})} />
          
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Article Image</label>
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const base64 = await resizeImage(file);
                      setFormData({...formData, image: base64});
                    }
                  }}
                  className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-red-600"
                />
                <button
                  type="button"
                  onClick={() => setShowImageSearch(!showImageSearch)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Search Images
                </button>
              </div>
              
              {showImageSearch && (
                <div className="border border-gray-300 rounded p-4">
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      placeholder="Search for images..."
                      value={imageSearch}
                      onChange={(e) => setImageSearch(e.target.value)}
                      className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-red-600"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const results = await searchUnsplashImages(imageSearch);
                        setSearchResults(results);
                      }}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                    >
                      Search
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                    {searchResults.map((img, idx) => (
                      <img
                        key={idx}
                        src={img.urls?.small}
                        alt={img.alt_description}
                        className="w-full h-24 object-cover cursor-pointer border border-gray-300 rounded hover:border-red-600"
                        onClick={async () => {
                          const base64 = await convertImageToBase64(img.urls?.regular);
                          if (base64) {
                            setFormData({...formData, image: base64});
                            setShowImageSearch(false);
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {formData.image && (
                <div className="mt-2">
                  <img src={formData.image} alt="Selected" className="w-32 h-20 object-cover border border-gray-300 rounded" />
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, image: ''})}
                    className="ml-2 text-red-600 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} className="bg-red-600 text-white px-6 py-2 rounded font-medium hover:bg-red-700" type="button">
              Submit for Review
            </button>
            <button onClick={() => setEditingId(null)} className="bg-gray-300 text-gray-900 px-6 py-2 rounded font-medium hover:bg-gray-400" type="button">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {articles.map(article => (
          <div key={article.id} className="bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-start">
            <div className="flex-1">
              <h3 className="font-bold text-lg text-gray-900">{article.title}</h3>
              <div className="text-sm text-gray-500 mt-1">{article.category} • {new Date(article.createdAt?.toDate?.()).toLocaleDateString()}</div>
              <span className={`inline-block mt-2 px-3 py-1 text-xs font-semibold rounded ${
                article.status === 'published' ? 'bg-green-100 text-green-800' : 
                article.status === 'needs_revision' ? 'bg-red-100 text-red-800' : 
                'bg-yellow-100 text-yellow-800'
              }`}>
                {article.status === 'published' ? 'Published' : 
                 article.status === 'needs_revision' ? 'Needs Revision' : 
                 'Pending Review'}
              </span>
              {article.revisionReason && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  <strong>Revision needed:</strong> {article.revisionReason}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {(article.status === 'pending_review' || article.status === 'needs_revision') && (
                <button onClick={() => {
                  setFormData(article);
                  setEditingId(article.id);
                }} className="text-blue-600 hover:text-blue-700" type="button">
                  <Edit2 size={18} />
                </button>
              )}
              {currentUser.role === 'admin' && (
                <button onClick={() => handleDelete(article.id)} className="text-red-600 hover:text-red-700" type="button">
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============ ADMIN DASHBOARD ============
const AdminDashboard = ({ currentUser, setCurrentPage }) => {
  const [section, setSection] = useState('articles');
  const [pendingArticles, setPendingArticles] = useState([]);
  const [writers, setWriters] = useState([]);
  const [newWriterEmail, setNewWriterEmail] = useState('');
  const [newWriterName, setNewWriterName] = useState('');
  const [articleAuthors, setArticleAuthors] = useState({});
  const [stats, setStats] = useState({ totalArticles: 0, totalViews: 0, writers: 0, editors: 0 });
  const [loading, setLoading] = useState(true);
  const [previewArticle, setPreviewArticle] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch pending articles
      const articlesRef = collection(db, 'articles');
      const q = query(articlesRef, where('status', '==', 'pending_review'), orderBy('createdAt', 'desc'));
      const articlesSnap = await getDocs(q);
      const articlesData = articlesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      setPendingArticles(articlesData);

      // Fetch authors for pending articles
      for (const article of articlesData) {
        const userDoc = await getDoc(doc(db, 'users', article.authorId));
        if (userDoc.exists()) {
          setArticleAuthors(prev => ({ ...prev, [article.authorId]: userDoc.data().name }));
        }
      }

      // Fetch writers and editors
      const usersRef = collection(db, 'users');
      const usersSnap = await getDocs(usersRef);
      const usersData = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const staffData = usersData.filter(u => u.role === 'writer' || u.role === 'editor');
      setWriters(staffData);

      // Calculate stats
      const allArticles = await getDocs(query(articlesRef, where('status', '==', 'published')));
      const totalArticles = allArticles.size;
      const totalViews = allArticles.docs.reduce((sum, doc) => sum + (doc.data().views || 0), 0);
      const writerCount = usersData.filter(u => u.role === 'writer').length;
      const editorCount = usersData.filter(u => u.role === 'editor').length;

      setStats({
        totalArticles,
        totalViews,
        writers: writerCount,
        editors: editorCount
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const publishArticle = async (id) => {
    try {
      await updateDoc(doc(db, 'articles', id), { status: 'published' });
      await fetchData();
    } catch (error) {
      console.error('Error publishing article:', error);
    }
  };

  const requestRevision = async (articleId, reason) => {
    try {
      await updateDoc(doc(db, 'articles', articleId), { 
        status: 'needs_revision',
        revisionReason: reason,
        revisionRequestedAt: new Date()
      });
      alert('Revision request sent to writer');
      await fetchData();
    } catch (error) {
      console.error('Error requesting revision:', error);
    }
  };

  const addWriter = async () => {
    if (!newWriterEmail.trim() || !newWriterName.trim()) {
      alert('Email and name required');
      return;
    }
    try {
      const usersRef = collection(db, 'users');
      await addDoc(usersRef, {
        email: newWriterEmail,
        name: newWriterName,
        role: 'writer',
        bio: 'Staff Writer'
      });
      setNewWriterEmail('');
      setNewWriterName('');
      await fetchData();
    } catch (error) {
      console.error('Error adding writer:', error);
    }
  };

  const removeWriter = async (id) => {
    try {
      await deleteDoc(doc(db, 'users', id));
      await fetchData();
    } catch (error) {
      console.error('Error removing writer:', error);
    }
  };

  const promoteToEditor = async (id, currentRole) => {
    try {
      const newRole = currentRole === 'editor' ? 'writer' : 'editor';
      await updateDoc(doc(db, 'users', id), { role: newRole });
      await fetchData();
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

  const createTestArticles = async () => {
    const categories = ['News', 'Sports', 'Opinion', 'Features', 'Arts'];
    const titles = [
      'Breaking: Major Development in City Council',
      'Local Team Wins Championship Game',
      'Opinion: The Future of Education',
      'New Restaurant Opens Downtown',
      'Art Gallery Features Local Artists',
      'Weather Alert: Storm Approaching',
      'Sports Update: Season Highlights',
      'Community Event This Weekend',
      'Technology News: Latest Updates',
      'Health Tips for Winter Season'
    ];
    
    try {
      for (let i = 0; i < 20; i++) {
        const randomHours = Math.floor(Math.random() * 72);
        const createdAt = new Date(Date.now() - randomHours * 60 * 60 * 1000);
        
        await addDoc(collection(db, 'articles'), {
          title: titles[Math.floor(Math.random() * titles.length)] + ` ${i + 1}`,
          content: '<p>This is a test article content for demonstration purposes.</p>',
          category: categories[Math.floor(Math.random() * categories.length)],
          image: `https://picsum.photos/300/200?random=${i}`,
          authorId: currentUser.id,
          status: 'published',
          views: Math.floor(Math.random() * 100),
          createdAt: createdAt,
          isTestData: true
        });
      }
      alert('20 test articles created!');
      await fetchData();
    } catch (error) {
      console.error('Error creating test articles:', error);
    }
  };

  const deleteTestArticles = async () => {
    try {
      const articlesRef = collection(db, 'articles');
      const q = query(articlesRef, where('isTestData', '==', true));
      const articlesSnap = await getDocs(q);
      
      for (const doc of articlesSnap.docs) {
        await deleteDoc(doc.ref);
      }
      
      alert('Test articles deleted!');
      await fetchData();
    } catch (error) {
      console.error('Error deleting test articles:', error);
    }
  };

  if (loading) {
    return <div className="max-w-6xl mx-auto px-4 py-8"><p>Loading...</p></div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

      <div className="flex gap-4 mb-8 border-b border-gray-200">
        <button
          onClick={() => { setSection('articles'); window.history.pushState({}, '', '?page=admin&section=articles'); }}
          className={`px-4 py-2 font-medium border-b-2 ${section === 'articles' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-600'}`}
          type="button"
        >
          <FileText className="inline mr-2" size={18} /> Articles
        </button>
        <button
          onClick={() => { setSection('writers'); window.history.pushState({}, '', '?page=admin&section=writers'); }}
          className={`px-4 py-2 font-medium border-b-2 ${section === 'writers' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-600'}`}
          type="button"
        >
          <Users className="inline mr-2" size={18} /> Staff
        </button>
        <button
          onClick={() => { setSection('analytics'); window.history.pushState({}, '', '?page=admin&section=analytics'); }}
          className={`px-4 py-2 font-medium border-b-2 ${section === 'analytics' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-600'}`}
          type="button"
        >
          <BarChart3 className="inline mr-2" size={18} /> Analytics
        </button>
      </div>

      {section === 'articles' && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Pending Articles ({pendingArticles.length})</h2>
          {pendingArticles.length === 0 ? (
            <p className="text-gray-500">No pending articles</p>
          ) : (
            <div className="space-y-4">
              {pendingArticles.map(article => (
                <div key={article.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="font-bold text-lg text-gray-900">{article.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">By {articleAuthors[article.authorId] || 'Unknown'} • {new Date(article.createdAt?.toDate?.()).toLocaleDateString()}</p>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => setPreviewArticle(article)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium" type="button">
                      Preview
                    </button>
                    <button onClick={() => publishArticle(article.id)} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-medium" type="button">
                      Publish
                    </button>
                    <button onClick={() => setShowRejectModal(article)} className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 font-medium" type="button">
                      Request Revision
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'writers' && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Manage Staff</h2>
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <div className="space-y-2 mb-4">
              <input
                type="text"
                placeholder="Name"
                value={newWriterName}
                onChange={(e) => setNewWriterName(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-red-600"
              />
              <input
                type="email"
                placeholder="Email"
                value={newWriterEmail}
                onChange={(e) => setNewWriterEmail(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-red-600"
              />
            </div>
            <button onClick={addWriter} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-medium" type="button">
              Add Writer
            </button>
          </div>
          <div className="space-y-2">
            {writers.map(writer => (
              <div key={writer.id} className="bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-900">{writer.name}</h3>
                  <p className="text-sm text-gray-600">{writer.email}</p>
                  <span className={`inline-block mt-1 px-2 py-1 text-xs font-semibold rounded ${writer.role === 'editor' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                    {writer.role === 'editor' ? 'Editor' : 'Writer'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => removeWriter(writer.id)} className="text-red-600 hover:text-red-700" type="button">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === 'analytics' && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Analytics Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-gray-600 text-sm font-medium">Published Articles</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{stats.totalArticles}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-gray-600 text-sm font-medium">Total Views</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{stats.totalViews}</div>
            </div>
          </div>
          
          <div className="mb-6">
            <TopArticlesChart />
          </div>
          <div className="mb-6">
            <CategoryViewsChart />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <WriterPerformanceChart />
            <PublishingTimelineChart />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <CommentEngagementChart />
            <CategoryAverageChart />
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-bold mb-4">Test Data</h3>
            <div className="flex gap-2">
              <button onClick={createTestArticles} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium" type="button">
                Create 20 Test Articles
              </button>
              <button onClick={deleteTestArticles} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-medium" type="button">
                Delete Test Articles
              </button>
              <button onClick={() => { localStorage.removeItem('tiger-times-visited'); window.location.href = '/'; }} className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 font-medium" type="button">
                Test Animation
              </button>
            </div>
          </div>
        </div>
      )}

      {previewArticle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-96 overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{previewArticle.title}</h2>
                  <p className="text-sm text-gray-600 mt-1">By {articleAuthors[previewArticle.authorId] || 'Unknown'} • {previewArticle.category}</p>
                </div>
                <button onClick={() => setPreviewArticle(null)} className="text-gray-500 hover:text-gray-700" type="button">
                  <X size={24} />
                </button>
              </div>
              <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: previewArticle.content }} />
              <div className="mt-6 flex gap-2">
                <button onClick={() => { publishArticle(previewArticle.id); setPreviewArticle(null); }} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-medium" type="button">
                  Publish
                </button>
                <button onClick={() => { setShowRejectModal(previewArticle); setPreviewArticle(null); }} className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 font-medium" type="button">
                  Request Revision
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Request Revision</h3>
            <p className="text-sm text-gray-600 mb-4">Article: {showRejectModal.title}</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain what needs to be revised..."
              className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:border-red-600"
              rows="4"
            />
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  if (rejectReason.trim()) {
                    requestRevision(showRejectModal.id, rejectReason);
                    setShowRejectModal(null);
                    setRejectReason('');
                  }
                }} 
                className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 font-medium" 
                type="button"
              >
                Send Revision Request
              </button>
              <button 
                onClick={() => {
                  setShowRejectModal(null);
                  setRejectReason('');
                }} 
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 font-medium" 
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ LIGHT CIRCLE ANIMATION COMPONENT ============
const LightAnimation = ({ onComplete, pageContent }) => {
  useEffect(() => {
    const completeTimer = setTimeout(onComplete, 6600);
    return () => clearTimeout(completeTimer);
  }, [onComplete]);

  return (
    <>
      <div className="page-behind">
        {pageContent}
      </div>
      <div className="light-overlay">
        <button onClick={onComplete} className="light-skip">
          Skip
        </button>
        
        <div className="light-circle"></div>
        
        <div className="light-content">
          <h1 className="light-title">The Tiger Times</h1>
          <p className="light-motto">"Let there be light"</p>
        </div>
      </div>
    </>
  );
};

// ============ MAIN APP ============
export default function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [currentUser, setCurrentUser] = useState(null);
  const [currentArticle, setCurrentArticle] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  

  const [loading, setLoading] = useState(true);
  const [showSunrise, setShowSunrise] = useState(false);

  useEffect(() => {
    document.title = 'The Tiger Times';
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setCurrentUser({ id: firebaseUser.uid, ...userDoc.data() });
          } else {
            const userData = {
              email: firebaseUser.email,
              name: firebaseUser.email.split('@')[0],
              role: 'viewer',
              bio: 'Reader'
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), userData);
            setCurrentUser({ id: firebaseUser.uid, ...userData });
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Check for first visit immediately
  useEffect(() => {
    const hasVisited = localStorage.getItem('tiger-times-visited');
    console.log('Has visited:', hasVisited);
    if (!hasVisited) {
      console.log('Setting showSunrise to true');
      setShowSunrise(true);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const articleId = params.get('article');
    const page = params.get('page');
    const category = params.get('category');
    const adminSection = params.get('section');
    
    if (articleId) {
      fetchArticleById(articleId);
    } else if (page) {
      setCurrentPage(page);
      if (category) setSearchTerm(category);
    }
  }, []);

  const fetchArticleById = async (articleId) => {
    try {
      const articleDoc = await getDoc(doc(db, 'articles', articleId));
      if (articleDoc.exists()) {
        setCurrentArticle({ id: articleDoc.id, ...articleDoc.data() });
        setCurrentPage('article');
      }
    } catch (error) {
      console.error('Error fetching article:', error);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      }
      setAuthEmail('');
      setAuthPassword('');
      setAuthName('');
      setShowAuthModal(false);
      setCurrentPage('home');
    } catch (error) {
      alert((isSignUp ? 'Sign up' : 'Login') + ' failed: ' + error.message);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setShowAuthModal(false);
      setCurrentPage('home');
    } catch (error) {
      alert('Google sign in failed: ' + error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setCurrentPage('home');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleSunriseComplete = () => {
    localStorage.setItem('tiger-times-visited', 'true');
    setShowSunrise(false);
  };

  if (loading && !showSunrise) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <div className="mb-4">
          <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full animate-pulse" style={{width: '60%'}}></div>
          </div>
        </div>
        <p className="text-white text-lg font-medium">Loading your experience...</p>
      </div>
    );
  }

  console.log('showSunrise:', showSunrise, 'loading:', loading);
  
  const pageContent = (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header>
        {/* Top Navigation Bar */}
        <div className="bg-red-700 text-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-3 items-center py-2">
              <div className="flex items-center relative">
                <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="text-white p-2 border border-white" type="button">
                  {showMobileMenu ? <X size={16} /> : <Menu size={16} />}
                </button>

              </div>
              <div className="flex justify-center">
                <CategoryNav setSearchTerm={setSearchTerm} setCurrentPage={setCurrentPage} currentUser={currentUser} searchTerm={searchTerm} />
              </div>
              <div className="flex items-center justify-end space-x-4">
                <button onClick={() => setCurrentPage('search')} className="text-white hover:text-red-200" type="button">
                  <Search size={16} />
                </button>
                {currentUser ? (
                  <>
                    <span className="text-sm">{currentUser.name}</span>
                    <button onClick={handleLogout} className="text-white hover:text-red-200" type="button">
                      <LogOut size={16} />
                    </button>
                  </>
                ) : (
                  <button onClick={() => setShowAuthModal(true)} className="bg-white text-red-700 px-3 py-1 rounded text-sm font-medium hover:bg-gray-100" type="button">
                    Login / Sign Up
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Header */}
        <div className="bg-white py-8">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-6">
              <h1 className="text-6xl font-serif text-red-700 font-normal cursor-pointer" onClick={() => { setCurrentPage('home'); setSearchTerm(''); }}>
                The Tiger Times
              </h1>
            </div>
            <div className="grid grid-cols-3 items-center text-sm text-gray-600">
              <div className="text-left">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
              <div className="text-center font-serif italic"><strong><i>"Let there be light"</i></strong></div>
              <div className="text-right">VOLUME I</div>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar Menu */}
      <div className={`fixed top-32 left-0 w-48 h-full bg-white border-r border-gray-200 shadow-lg z-50 transform transition-transform duration-300 ${showMobileMenu ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <button onClick={() => setShowMobileMenu(false)} className="text-gray-500 hover:text-gray-700" type="button">
              <X size={20} />
            </button>
            <button onClick={() => { setCurrentPage('search'); setShowMobileMenu(false); }} className="text-gray-700 hover:text-red-600" type="button">
              <Search size={20} />
            </button>
          </div>
          <div className="space-y-4">
            {['News', 'Opinion', 'Arts', 'Sports', 'Features'].map(cat => (
              <button key={cat} onClick={() => { setSearchTerm(cat); setCurrentPage('home'); setShowMobileMenu(false); }} className="block w-full text-left text-gray-700 hover:text-red-600 uppercase tracking-wide text-sm font-medium" type="button">{cat}</button>
            ))}
            {currentUser && currentUser.role === 'admin' && (
              <button onClick={() => { setCurrentPage('admin'); setShowMobileMenu(false); }} className="block w-full text-left text-gray-700 hover:text-red-600 uppercase tracking-wide text-sm font-medium" type="button">Admin</button>
            )}
            {currentUser && (currentUser.role === 'writer' || currentUser.role === 'editor' || currentUser.role === 'admin') && (
              <button onClick={() => { setCurrentPage('writer'); setShowMobileMenu(false); }} className="block w-full text-left text-gray-700 hover:text-red-600 uppercase tracking-wide text-sm font-medium" type="button">Write</button>
            )}
          </div>
        </div>
      </div>

      {/* Page Content */}
      {currentPage === 'home' && <HomePage setCurrentPage={setCurrentPage} setCurrentArticle={setCurrentArticle} searchTerm={searchTerm} setSearchTerm={setSearchTerm} showSunrise={showSunrise} />}
      {currentPage === 'search' && <SearchPage setCurrentPage={setCurrentPage} setCurrentArticle={setCurrentArticle} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />}
      {currentPage === 'article' && currentArticle && <ArticlePage article={currentArticle} setCurrentPage={setCurrentPage} currentUser={currentUser} />}
      {currentPage === 'writer' && currentUser && <WriterDashboard currentUser={currentUser} setCurrentPage={setCurrentPage} />}
      {currentPage === 'admin' && currentUser?.role === 'admin' && <AdminDashboard currentUser={currentUser} setCurrentPage={setCurrentPage} />}
    </div>
  );

  if (showSunrise) {
    return <LightAnimation onComplete={handleSunriseComplete} pageContent={pageContent} />;
  }

  return (
    <>
      {pageContent}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{zIndex: 9999}}>
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{isSignUp ? 'Sign Up' : 'Login'}</h2>
              <button onClick={() => setShowAuthModal(false)} className="text-gray-500 hover:text-gray-700" type="button">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAuth} className="space-y-4">
              {isSignUp && (
                <input
                  type="text"
                  placeholder="Name"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-red-600"
                />
              )}
              <input
                type="email"
                placeholder="Email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-red-600"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-red-600"
                required
              />
              <button type="submit" className="w-full bg-red-600 text-white py-2 rounded font-bold hover:bg-red-700">
                {isSignUp ? 'Sign Up' : 'Login'}
              </button>
            </form>
            
            <div className="mt-4">
              <div className="text-center text-gray-500 text-sm mb-4">or</div>
              <button 
                onClick={handleGoogleAuth}
                className="w-full bg-white border border-gray-300 text-gray-700 py-2 rounded font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
                type="button"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
            </div>
            
            <div className="mt-4 text-center">
              <button 
                onClick={() => setIsSignUp(!isSignUp)} 
                className="text-red-600 hover:text-red-700 text-sm"
                type="button"
              >
                {isSignUp ? 'Already have an account? Login' : "Don't have an account? Sign up"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}