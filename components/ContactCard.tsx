
import React from 'react';
import { Contact } from '../types';

interface ContactCardProps {
  contact: Contact;
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
  t?: (key: string) => string;
}

const ContactCard: React.FC<ContactCardProps> = ({ contact, onEdit, onDelete, t = (k) => k }) => {
  const formatDate = (dateInput: string | number) => {
    if (!dateInput) return 'Unknown';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const ensureAbsoluteUrl = (url: string, platform?: 'instagram' | 'facebook') => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    
    if (platform === 'instagram' && url.startsWith('@')) {
      return `https://instagram.com/${url.substring(1)}`;
    }
    
    if (platform === 'facebook' && !url.includes('.com')) {
      return `https://facebook.com/${url}`;
    }

    return `https://${url}`;
  };

  const VerifiedBadge = () => (
    <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-0.5 border border-white dark:border-slate-800">
      <svg className="w-1.5 h-1.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
      </svg>
    </div>
  );

  const SocialIcons = () => (
    <div className="flex items-center gap-2.5 ml-3">
      {contact.facebook && (
        <div className="relative group/icon">
          <a 
            href={ensureAbsoluteUrl(contact.facebook, 'facebook')} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-blue-600 transition-colors block"
            title="Verified Facebook Profile"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </a>
          <VerifiedBadge />
        </div>
      )}
      {contact.instagram && (
        <div className="relative group/icon">
          <a 
            href={ensureAbsoluteUrl(contact.instagram, 'instagram')} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-pink-600 transition-colors block"
            title="Verified Instagram Profile"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
            </svg>
          </a>
          <VerifiedBadge />
        </div>
      )}
      {contact.website && (
        <div className="relative group/icon">
          <a 
            href={ensureAbsoluteUrl(contact.website)} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-emerald-600 transition-colors block"
            title="Verified Website"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10z"></path>
            </svg>
          </a>
          <VerifiedBadge />
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 h-full flex flex-col group relative overflow-hidden">
      <div className="p-6 flex-1 relative z-10">
        <div className="flex items-start gap-4">
          <img 
            src={contact.avatarUrl} 
            alt={`${contact.firstName} ${contact.lastName}`}
            className="w-14 h-14 rounded-xl object-cover border border-slate-100 dark:border-slate-800 shadow-sm"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">
                {contact.firstName} {contact.lastName}
              </h3>
              <SocialIcons />
            </div>
            <div className="mt-1 flex items-center">
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
                {contact.position || t('personnel')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 uppercase tracking-widest truncate">
              {contact.company || t('privatePractice')}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-3 text-xs font-medium text-slate-600 dark:text-slate-400">
            <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <span className="truncate">{contact.email || 'No email registered'}</span>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium text-slate-600 dark:text-slate-400">
            <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            </div>
            <span>{contact.phone || 'Phone hidden'}</span>
          </div>
        </div>

        {/* Temporal Metadata Section */}
        <div className="mt-6 flex items-center justify-between px-1 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t('joined')}</span>
            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{formatDate(contact.dateJoined)}</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t('dbRegistry')}</span>
            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{formatDate(contact.createdAt)}</span>
          </div>
        </div>
      </div>
      
      <div className="flex border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        <button 
          onClick={() => onEdit(contact)}
          className="flex-1 py-3 text-[10px] font-black text-slate-500 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-800 transition-all uppercase tracking-widest"
        >
          {t('modify')}
        </button>
        <div className="w-px bg-slate-100 dark:bg-slate-800"></div>
        <button 
          onClick={() => onDelete(contact.id)}
          className="flex-1 py-3 text-[10px] font-black text-slate-500 hover:text-red-600 hover:bg-white dark:hover:bg-slate-800 transition-all uppercase tracking-widest"
        >
          {t('erase')}
        </button>
      </div>
    </div>
  );
};

export default ContactCard;