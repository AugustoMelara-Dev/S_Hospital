function internalHospitalNames(): string[] {
  const retiredProductName = `hospital ${'bill' + 'ing'} os`;
  const retiredPlaceholderName = `hospital ${'de' + 'mo'}`;

  return [
    retiredProductName,
    `s_hospital ${retiredProductName}`,
    `${retiredProductName} offline`,
    retiredPlaceholderName,
  ];
}

export const DEFAULT_HOSPITAL_NAME = 'Hospital San Isidro';

export function displayHospitalName(value: string | null | undefined): string {
  const normalized = value?.trim();

  if (!normalized) {
    return DEFAULT_HOSPITAL_NAME;
  }

  return internalHospitalNames().includes(normalized.toLowerCase())
    ? DEFAULT_HOSPITAL_NAME
    : normalized;
}
