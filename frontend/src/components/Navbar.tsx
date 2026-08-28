import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, LogOut, Search, Loader2, File, Folder } from 'lucide-react';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';

type SearchResult = {
  id: string;
  name?: string;
  originalName?: string;
  type: 'file' | 'folder';
  location: string;
};

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Perform search
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const performSearch = async () => {
      setIsSearching(true);
      try {
        const response = await api.get('/search', { params: { q: debouncedQuery } });
        setResults(response.data.data.results);
      } catch (error) {
        console.error('Search failed', error);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedQuery]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResultClick = () => {
    setIsDropdownOpen(false);
    setQuery('');
    navigate('/dashboard');
  };

  return (
    <nav className="sticky top-0 z-30 h-16 bg-zinc-950/55 backdrop-blur-2xl border-b border-white/10 px-6 flex items-center justify-between shadow-2xl shadow-black/20">
      <Link to="/dashboard" className="flex items-center gap-2.5 cursor-pointer">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent text-white shadow-lg shadow-indigo-500/20">
          <Shield className="w-4 h-4" />
        </span>
        <span className="text-base font-semibold text-primary">SecureDoc</span>
      </Link>

      <div className="flex-1 max-w-xl px-8" ref={searchRef}>
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder="Search files and folders..."
              className="w-full py-2.5 pl-9 pr-4 rounded-xl bg-white/5 backdrop-blur border border-white/10 text-sm text-primary placeholder-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all"
            />
            {isSearching && <Loader2 className="absolute right-3 w-4 h-4 text-muted animate-spin" />}
          </div>

          {isDropdownOpen && query.trim() !== '' && (
            <div className="absolute top-full mt-2 w-full glass-panel rounded-xl z-50 max-h-96 overflow-y-auto">
              {!isSearching && results.length === 0 ? (
                <div className="p-4 text-sm text-muted text-center">No results found for "{query}"</div>
              ) : (
                <div className="py-1 divide-y divide-border/50">
                  {results.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleResultClick()}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-bg cursor-pointer text-left transition-colors"
                    >
                      {result.type === 'folder' ? (
                        <Folder className="w-4 h-4 text-accent shrink-0" />
                      ) : (
                        <File className="w-4 h-4 text-muted shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-primary truncate">
                          {result.type === 'folder' ? result.name : result.originalName}
                        </p>
                        <p className="text-xs text-muted truncate">in {result.location}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-primary">{user?.name || 'User'}</p>
          <p className="text-xs text-muted">{user?.email}</p>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-primary bg-white/5 backdrop-blur border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Logout
        </button>
      </div>
    </nav>
  );
}
