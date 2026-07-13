export const avatarPlaceholder = (seed: string) =>
  `https://i.pravatar.cc/300?u=${encodeURIComponent(seed)}`;

export const sportPhotoPlaceholder = (seed: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/600/800`;
