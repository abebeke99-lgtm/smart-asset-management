import React, { useEffect, useMemo, useState } from 'react';
import { resolveAssetUrl } from '../../services/apiClient';

const toInitials = (user = {}) => {
  const fullName = String(user?.fullName || user?.full_name || user?.name || user?.username || 'U').trim();
  const parts = fullName.split(/\s+/).filter(Boolean);

  if (!parts.length) return 'U';

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const UserAvatar = ({ user, size = 'md', className = '' }) => {
  const profilePhoto = user?.profilePhoto || user?.profile_photo || null;
  const imageUrl = useMemo(() => resolveAssetUrl(profilePhoto), [profilePhoto]);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  const avatarClassName = ['user-avatar', `user-avatar--${size}`, className].filter(Boolean).join(' ');

  if (profilePhoto && imageUrl && !imageFailed) {
    return (
      <div className={avatarClassName} aria-label={user?.fullName || user?.username || 'User avatar'}>
        <img
          src={imageUrl}
          alt={user?.fullName || user?.username || 'User'}
          onError={() => setImageFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${avatarClassName} user-avatar--fallback`} aria-label={user?.fullName || user?.username || 'User avatar'}>
      {toInitials(user)}
    </div>
  );
};

export default UserAvatar;
