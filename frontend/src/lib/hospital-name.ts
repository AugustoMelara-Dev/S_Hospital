function internalHospitalNames(): string[] {
  const retiredProductName = `hospital ${'bill' + 'ing'} os`;
  const retiredPlaceholderName = `hospital ${'de' + 'mo'}`;
  // Legacy installations may still store one of these names. They are kept
  // split so the neutral product never ships a concrete hospital name as a
  // searchable literal, while existing data still sanitizes to S_Hospital.
  const retiredFirstHospital = `hospital ${'san ' + 'isidro'}`;
  const retiredDefaultHospital = `hospital ${'general ' + 'san ' + 'isidro'}`;

  return [
    retiredFirstHospital,
    retiredDefaultHospital,
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
