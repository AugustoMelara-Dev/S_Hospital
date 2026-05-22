const INTERNAL_HOSPITAL_NAMES = [
  'hospital billing os',
  's_hospital billing os',
  'hospital billing os offline',
];

export function displayHospitalName(value: string | null | undefined): string {
  const normalized = value?.trim();

  if (!normalized) {
    return 'Caja hospitalaria';
  }

  return INTERNAL_HOSPITAL_NAMES.includes(normalized.toLowerCase())
    ? 'Caja hospitalaria'
    : normalized;
}
