export function roleLabel(roleName: string): string {
  return roleName
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function roleListLabel(roles: string[]): string {
  return roles.length > 0 ? roles.map(roleLabel).join(', ') : 'Sin rol';
}
