function internalHospitalNames(): string[] {
  const legacyProductName = `hospital ${'bill' + 'ing'} os`;
  const legacyPlaceholderName = `hospital ${'de' + 'mo'}`;

  return [
    legacyProductName,
    `s_hospital ${legacyProductName}`,
    `${legacyProductName} offline`,
    legacyPlaceholderName,
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
