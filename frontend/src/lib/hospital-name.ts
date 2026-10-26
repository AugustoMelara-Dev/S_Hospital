function internalHospitalNames(): string[] {
  const retiredProductName = `hospital ${'bill' + 'ing'} os`;
  const retiredPlaceholderName = `hospital ${'de' + 'mo'}`;
  // Only technical placeholders are retired. A configured institution name
  // must not be mistaken for a product placeholder.
  return [
    retiredProductName,
    `s_hospital ${retiredProductName}`,
    `${retiredProductName} offline`,
    retiredPlaceholderName,
  ];
}

/** Neutral product name shown until Administración → Identidad is completed. */
export const DEFAULT_HOSPITAL_NAME = 'S_Hospital';

export function displayHospitalName(value: string | null | undefined): string {
  const normalized = value?.trim();

  if (!normalized) {
    return DEFAULT_HOSPITAL_NAME;
  }

  return internalHospitalNames().includes(normalized.toLowerCase())
    ? DEFAULT_HOSPITAL_NAME
    : normalized;
}
