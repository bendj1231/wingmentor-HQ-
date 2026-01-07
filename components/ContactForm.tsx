
import React, { useState, useEffect, useRef } from 'react';
import { Contact, NewContact, CustomGroup } from '../types';
import Button from './Button';

interface ContactFormProps {
  initialData?: Contact;
  availableGroups?: CustomGroup[];
  onSubmit: (data: NewContact | Contact) => void;
  onCancel: () => void;
  t?: (key: string) => string;
}

const ContactForm: React.FC<ContactFormProps> = ({ initialData, availableGroups = [], onSubmit, onCancel, t = (k) => k }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(initialData?.avatarUrl || '');
  const [formData, setFormData] = useState<NewContact>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    position: '',
    remarks: '',
    dateJoined: new Date().toISOString().split('T')[0],
    avatarUrl: initialData?.avatarUrl || '',
    facebook: '',
    instagram: '',
    website: '',
    customGroups: initialData?.customGroups || []
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        firstName: initialData.firstName,
        lastName: initialData.lastName,
        email: initialData.email,
        phone: initialData.phone,
        company: initialData.company,
        position: initialData.position,
        remarks: initialData.remarks || '',
        dateJoined: initialData.dateJoined || new Date().toISOString().split('T')[0],
        avatarUrl: initialData.avatarUrl,
        facebook: initialData.facebook || '',
        instagram: initialData.instagram || '',
        website: initialData.website || '',
        customGroups: initialData.customGroups || []
      });
      setPreviewUrl(initialData.avatarUrl);
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleGroup = (groupId: string) => {
    setFormData(prev => {
      const current = prev.customGroups || [];
      const updated = current.includes(groupId)
        ? current.filter(id => id !== groupId)
        : [...current, groupId];
      return { ...prev, customGroups: updated };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setPreviewUrl(base64String);
        setFormData(prev => ({ ...prev, avatarUrl: base64String }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (initialData) {
      onSubmit({ ...initialData, ...formData });
    } else {
      onSubmit(formData);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const inputClasses = "w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400";
  const labelClasses = "block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col items-center gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div className="relative group">
          <div 
            onClick={triggerFileInput}
            className={`w-24 h-24 rounded-2xl overflow-hidden border-2 cursor-pointer transition-all duration-300 flex items-center justify-center bg-slate-50 dark:bg-slate-800 ${previewUrl ? 'border-blue-500' : 'border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-400'}`}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center text-slate-400">
                <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-2xl backdrop-blur-sm">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
        </div>
        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">{t('profilePicture')}</p>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className={labelClasses}>{t('givenName')}</label>
          <input
            required
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            className={inputClasses}
            placeholder="Alex"
          />
        </div>
        <div>
          <label className={labelClasses}>{t('surname')}</label>
          <input
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            className={inputClasses}
            placeholder="Rivera"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className={labelClasses}>{t('emailAddress')}</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={inputClasses}
            placeholder="alex@nexus.com"
          />
        </div>
        <div>
          <label className={labelClasses}>{t('phone')}</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className={inputClasses}
            placeholder="+1 (555) 000-0000"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className={labelClasses}>{t('company')}</label>
          <input
            name="company"
            value={formData.company}
            onChange={handleChange}
            className={inputClasses}
            placeholder="Company Ltd."
          />
        </div>
        <div>
          <label className={labelClasses}>{t('position')}</label>
          <input
            name="position"
            value={formData.position}
            onChange={handleChange}
            className={inputClasses}
            placeholder="Senior Architect"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div>
          <label className={labelClasses}>Facebook</label>
          <input
            name="facebook"
            value={formData.facebook}
            onChange={handleChange}
            className={inputClasses}
            placeholder="username"
          />
        </div>
        <div>
          <label className={labelClasses}>Instagram</label>
          <input
            name="instagram"
            value={formData.instagram}
            onChange={handleChange}
            className={inputClasses}
            placeholder="@username"
          />
        </div>
        <div>
          <label className={labelClasses}>Website</label>
          <input
            name="website"
            value={formData.website}
            onChange={handleChange}
            className={inputClasses}
            placeholder="example.com"
          />
        </div>
      </div>

      {availableGroups.length > 0 && (
        <div>
          <label className={labelClasses}>{t('customLists')}</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {availableGroups.map(group => (
              <button
                key={group.id}
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                  formData.customGroups?.includes(group.id)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                {group.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className={labelClasses}>{t('registryDate')}</label>
          <input
            type="date"
            name="dateJoined"
            value={formData.dateJoined}
            onChange={handleChange}
            className={`${inputClasses} appearance-none`}
          />
        </div>
      </div>

      <div>
        <label className={labelClasses}>{t('remarks')}</label>
        <textarea
          name="remarks"
          value={formData.remarks}
          onChange={handleChange}
          rows={3}
          className={`${inputClasses} resize-none`}
          placeholder=""
        />
      </div>

      <div className="flex gap-4 justify-end pt-6 border-t border-slate-100 dark:border-slate-800">
        <Button variant="ghost" type="button" onClick={onCancel} className="font-bold text-[10px] uppercase tracking-widest">
          {t('discard')}
        </Button>
        <Button variant="primary" type="submit" className="px-8 py-3 rounded-xl shadow-lg shadow-blue-500/20">
          {initialData ? t('updateProfile') : t('confirmRegistry')}
        </Button>
      </div>
    </form>
  );
};

export default ContactForm;