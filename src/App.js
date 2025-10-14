import React, { useState, useEffect, useRef } from 'react';
import { Search, LogOut, Menu, X, Send, Trash2, Edit2, Plus, BarChart3, Users, FileText, Heart, MessageCircle } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, addDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

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

// ============ BAD WORDS FILTER ============
const BAD_WORDS = ['badword1', 'badword2', 'inappropriate', 'offensive'];

const filterBadWords = (text) => {
  let filtered = text;
  BAD_WORDS.forEach(word => {
    filtered = filtered.replace(new RegExp(word, 'gi'), '*'.repeat(word.length));
  });
  return filtered;
};

// ============ RICH TEXT EDITOR ============
const RichTextEditor = ({ value, onChange }) => {
  const editorRef = useRef(null);

  const applyFormat = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <div className="bg-gray-100 border-b border-gray-300 p-2 flex flex-wrap gap-1">
        <button onClick={() => applyFormat('bold')} className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 font-bold" type="button">B</button>
        <button onClick={() => applyFormat('italic')} className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 italic" type="button">I</button>
        <button onClick={() => applyFormat('underline')} className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 underline" type="button">U</button>
        <div className="w-px bg-gray-300"></div>
        <button onClick={() => applyFormat('formatBlock', '<h1>')} className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm" type="button">H1</button>
        <button onClick={() => applyFormat('formatBlock', '<h2>')} className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm" type="button">H2</button>
        <button onClick={() => applyFormat('formatBlock', '<h3>')} className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm" type="button">H3</button>
        <button onClick={() => applyFormat('formatBlock', '<p>')} className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm" type="button">P</button>
        <div className="w-px bg-gray-300"></div>
        <button onClick={() => applyFormat('insertUnorderedList')} className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm" type="button">• List</button>
        <button onClick={() => applyFormat('createLink', prompt('Enter URL:'))} className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm" type="button">Link</button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        className="p-4 min-h-96 focus:outline-none bg-white"
        style={{ whiteSpace: 'pre-wrap' }}
        suppressContentEditableWarning
      >
        {value || ''}
      </div>
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
          onClick={() => setShowReplies(!showReplies)}
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
          {currentUser && (
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
              onLike={onReplyLike}
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

// ============ ARTICLE CARD COMPONENT ============
const ArticleCard = ({ article, authorName, onRead }) => (
  <div onClick={() => onRead(article)} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition cursor-pointer">
    <div className="p-4">
      <div className="text-xs font-semibold text-red-600 uppercase tracking-wide">{article.category}</div>
      <h3 className="text-xl font-bold text-gray-900 mt-1 line-clamp-2">{article.title}</h3>
      <div className="text-sm text-gray-500 mt-2">By {authorName}</div>
      <div className="text-xs text-gray-400 mt-1">{new Date(article.createdAt?.toDate?.()).toLocaleDateString()}</div>
    </div>
  </div>
);

// ============ HOME PAGE ============
const HomePage = ({ setCurrentPage, setCurrentArticle, searchTerm, setSearchTerm }) => {
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
      <div className="bg-white border-b border-gray-200 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-7xl font-serif font-bold text-gray-900">The Tiger Times</h1>
          <p className="text-gray-500 mt-2">Integrity Over Tyranny, Freedom Forever</p>
        </div>
      </div>

      <div className="bg-gray-50 border-b border-gray-200 py-4">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-4 overflow-x-auto pb-2">
            {categories.map(cat => (
              <button key={cat} onClick={() => setSearchTerm(cat)} className="px-4 py-2 bg-white border border-gray-300 rounded-full text-sm font-medium hover:bg-gray-100 whitespace-nowrap" type="button">
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading articles...</p>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No articles found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map(article => (
              <ArticleCard
                key={article.id}
                article={article}
                authorName={authorNames[article.authorId] || 'Unknown'}
                onRead={(article) => {
                  setCurrentArticle(article);
                  setCurrentPage('article');
                }}
              />
            ))}
          </div>
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
  }, [article]);

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

  const handleReplyLike = async (articleId, commentId, replyId, isLiked) => {
    if (!currentUser) return;
    try {
      const replyRef = doc(db, 'articles', articleId, 'comments', commentId, 'replies', replyId);
      if (isLiked) {
        await updateDoc(replyRef, {
          likes: arrayRemove(currentUser.id),
          likeCount: (await getDoc(replyRef)).data().likeCount - 1
        });
      } else {
        await updateDoc(replyRef, {
          likes: arrayUnion(currentUser.id),
          likeCount: (await getDoc(replyRef)).data().likeCount + 1
        });
      }
    } catch (error) {
      console.error('Error liking reply:', error);
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
          <button onClick={() => setCurrentPage('home')} className="text-red-600 hover:text-red-700 font-medium mb-4" type="button">← Back</button>
          <div className="text-xs font-semibold text-red-600 uppercase tracking-wide">{article.category}</div>
          <h1 className="text-5xl font-serif font-bold text-gray-900 mt-2">{article.title}</h1>
          <div className="flex items-center mt-4 text-gray-600">
            <div>
              <div className="font-semibold">{authorName}</div>
              <div className="text-sm text-gray-500">{new Date(article.createdAt?.toDate?.()).toLocaleDateString()}</div>
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
                onReplyLike={handleReplyLike}
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
  const [formData, setFormData] = useState({ title: '', content: '', category: 'News' });
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
      setArticles(articlesData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching articles:', error);
      setLoading(false);
    }
  };

  const handleNew = () => {
    setEditingId('new');
    setFormData({ title: '', content: '', category: 'News' });
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
          authorId: currentUser.id,
          status: 'pending_review',
          createdAt: new Date(),
          views: 0
        });
      }
      setEditingId(null);
      setFormData({ title: '', content: '', category: 'News' });
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
              <span className={`inline-block mt-2 px-3 py-1 text-xs font-semibold rounded ${article.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {article.status === 'published' ? 'Published' : 'Pending Review'}
              </span>
            </div>
            <div className="flex gap-2">
              {article.status === 'pending_review' && (
                <button onClick={() => {
                  setFormData(article);
                  setEditingId(article.id);
                }} className="text-blue-600 hover:text-blue-700" type="button">
                  <Edit2 size={18} />
                </button>
              )}
              <button onClick={() => handleDelete(article.id)} className="text-red-600 hover:text-red-700" type="button">
                <Trash2 size={18} />
              </button>
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

  const rejectArticle = async (id) => {
    try {
      await deleteDoc(doc(db, 'articles', id));
      await fetchData();
    } catch (error) {
      console.error('Error rejecting article:', error);
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

  if (loading) {
    return <div className="max-w-6xl mx-auto px-4 py-8"><p>Loading...</p></div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

      <div className="flex gap-4 mb-8 border-b border-gray-200">
        <button
          onClick={() => setSection('articles')}
          className={`px-4 py-2 font-medium border-b-2 ${section === 'articles' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-600'}`}
          type="button"
        >
          <FileText className="inline mr-2" size={18} /> Articles
        </button>
        <button
          onClick={() => setSection('writers')}
          className={`px-4 py-2 font-medium border-b-2 ${section === 'writers' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-600'}`}
          type="button"
        >
          <Users className="inline mr-2" size={18} /> Staff
        </button>
        <button
          onClick={() => setSection('analytics')}
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
                    <button onClick={() => publishArticle(article.id)} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-medium" type="button">
                      Publish
                    </button>
                    <button onClick={() => rejectArticle(article.id)} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-medium" type="button">
                      Reject
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
                  <button
                    onClick={() => promoteToEditor(writer.id, writer.role)}
                    className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                    type="button"
                  >
                    {writer.role === 'editor' ? 'Demote' : 'Promote'}
                  </button>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-gray-600 text-sm font-medium">Published Articles</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{stats.totalArticles}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-gray-600 text-sm font-medium">Total Views</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{stats.totalViews}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-gray-600 text-sm font-medium">Active Writers</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{stats.writers}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-gray-600 text-sm font-medium">Editors</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{stats.editors}</div>
            </div>
          </div>
        </div>
      )}
    </div>
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
  const [loading, setLoading] = useState(true);

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
              role: 'admin',
              bio: 'Administrator'
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

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, authEmail, authPassword);
      setAuthEmail('');
      setAuthPassword('');
      setCurrentPage('home');
    } catch (error) {
      alert('Login failed: ' + error.message);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full border border-gray-200">
          <h1 className="text-4xl font-serif font-bold text-gray-900 text-center mb-2">The Tiger Times</h1>
          <p className="text-center text-gray-600 text-sm mb-6">Staff Login</p>

          <form onSubmit={handleLogin} className="space-y-4">
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
              Login
            </button>
          </form>

          <div className="mt-6 p-4 bg-gray-50 rounded text-xs text-gray-600">
            <p className="font-semibold mb-2">Demo Account:</p>
            <p>Email: eitan.alperstein@gmail.com</p>
            <p className="text-gray-500 mt-1">Use the password you set in Firebase</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-serif font-bold text-gray-900 cursor-pointer" onClick={() => { setCurrentPage('home'); setSearchTerm(''); }}>
              The Tiger Times
            </h1>
            <div className="hidden md:flex items-center gap-4">
              {currentUser.role === 'admin' && (
                <button onClick={() => setCurrentPage('admin')} className="text-gray-600 hover:text-red-600 font-medium" type="button">
                  Admin
                </button>
              )}
              {(currentUser.role === 'writer' || currentUser.role === 'editor' || currentUser.role === 'admin') && (
                <button onClick={() => setCurrentPage('writer')} className="text-gray-600 hover:text-red-600 font-medium" type="button">
                  {currentUser.role === 'admin' ? 'Write' : currentUser.role === 'editor' ? 'Manage' : 'Write'}
                </button>
              )}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4 flex-1 max-w-md mx-8">
            <Search size={20} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search articles..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage('home');
              }}
              className="flex-1 bg-transparent focus:outline-none text-sm"
            />
          </div>

          <div className="hidden md:flex items-center gap-4">
            <span className="text-sm text-gray-600">{currentUser.name}</span>
            <button onClick={handleLogout} className="text-gray-600 hover:text-red-600" type="button">
              <LogOut size={20} />
            </button>
          </div>

          {/* Mobile Menu */}
          <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="md:hidden" type="button">
            {showMobileMenu ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {showMobileMenu && (
          <div className="md:hidden bg-gray-50 border-t border-gray-200 p-4 space-y-3">
            <input
              type="text"
              placeholder="Search articles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
            {currentUser.role === 'admin' && (
              <button onClick={() => { setCurrentPage('admin'); setShowMobileMenu(false); }} className="block w-full text-left px-3 py-2 text-gray-600 hover:bg-gray-100 rounded" type="button">
                Admin
              </button>
            )}
            {(currentUser.role === 'writer' || currentUser.role === 'editor' || currentUser.role === 'admin') && (
              <button onClick={() => { setCurrentPage('writer'); setShowMobileMenu(false); }} className="block w-full text-left px-3 py-2 text-gray-600 hover:bg-gray-100 rounded" type="button">
                {currentUser.role === 'admin' ? 'Write' : currentUser.role === 'editor' ? 'Manage' : 'Write'}
              </button>
            )}
            <button onClick={() => { handleLogout(); setShowMobileMenu(false); }} className="block w-full text-left px-3 py-2 text-gray-600 hover:bg-gray-100 rounded flex items-center gap-2" type="button">
              <LogOut size={16} /> Logout
            </button>
          </div>
        )}
      </header>

      {/* Page Content */}
      {currentPage === 'home' && <HomePage setCurrentPage={setCurrentPage} setCurrentArticle={setCurrentArticle} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />}
      {currentPage === 'article' && currentArticle && <ArticlePage article={currentArticle} setCurrentPage={setCurrentPage} currentUser={currentUser} />}
      {currentPage === 'writer' && <WriterDashboard currentUser={currentUser} setCurrentPage={setCurrentPage} />}
      {currentPage === 'admin' && currentUser.role === 'admin' && <AdminDashboard currentUser={currentUser} setCurrentPage={setCurrentPage} />}
    </div>
  );
}