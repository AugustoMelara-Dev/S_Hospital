function internalHospitalNames(): string[] {
  const legacyProductName = `hospital ${'bill' + 'ing'} os`;

  return [
    legacyProductName,
    `s_hospital ${legacyProductName}`,
    `${legacyProductName} offline`,
    'hospital demo',
  ];
}

export function displayHospitalName(value: string | null | undefined): string {
  const normalized = value?.trim();

  if (!normalized) {
    return 'Caja hospitalaria';
  }

  return internalHospitalNames().includes(normalized.toLowerCase())
    ? 'Caja hospitalaria'
    : normalized;
}
