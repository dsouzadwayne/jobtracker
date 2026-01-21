/**
 * JobTracker Autocomplete Map
 * Complete HTML5 autocomplete attribute mapping following WHATWG standard
 * Provides bidirectional lookup between autocomplete values and field types
 */

/**
 * Map from HTML5 autocomplete attribute values to internal field types
 * Based on WHATWG HTML Living Standard autofill field names
 * https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill
 */
const AUTOCOMPLETE_TO_FIELD = {
  // Name fields
  'name': 'fullName',
  'honorific-prefix': 'prefix',
  'given-name': 'firstName',
  'additional-name': 'middleName',
  'family-name': 'lastName',
  'honorific-suffix': 'suffix',
  'nickname': 'nickname',

  // Contact information
  'email': 'email',
  'username': 'username',
  'tel': 'phone',
  'tel-country-code': 'phoneCountryCode',
  'tel-national': 'phone',
  'tel-local': 'phone',
  'tel-extension': 'phoneExtension',
  'url': 'portfolio',

  // Address fields
  'street-address': 'street',
  'address-line1': 'street',
  'address-line2': 'addressLine2',
  'address-line3': 'addressLine3',
  'address-level4': 'addressLevel4',  // Sublocality
  'address-level3': 'addressLevel3',  // Neighborhood
  'address-level2': 'city',           // City
  'address-level1': 'state',          // State/Province
  'country': 'country',
  'country-name': 'country',
  'postal-code': 'zipCode',

  // Organization
  'organization': 'currentCompany',
  'organization-title': 'currentTitle',

  // Birth date
  'bday': 'dateOfBirth',
  'bday-day': 'birthDay',
  'bday-month': 'birthMonth',
  'bday-year': 'birthYear',

  // Gender
  'sex': 'gender',

  // Credit card (not typically used in job apps, but included for completeness)
  'cc-name': 'ccName',
  'cc-given-name': 'ccFirstName',
  'cc-additional-name': 'ccMiddleName',
  'cc-family-name': 'ccLastName',
  'cc-number': 'ccNumber',
  'cc-exp': 'ccExpiry',
  'cc-exp-month': 'ccExpiryMonth',
  'cc-exp-year': 'ccExpiryYear',
  'cc-csc': 'ccCsc',
  'cc-type': 'ccType',

  // Transaction
  'transaction-currency': 'currency',
  'transaction-amount': 'amount',

  // Language
  'language': 'language',

  // One-time codes
  'one-time-code': 'otp'
};

/**
 * Reverse map: field type to autocomplete values
 * One field type can have multiple valid autocomplete values
 */
const FIELD_TO_AUTOCOMPLETE = {};

// Build reverse map
for (const [autocomplete, fieldType] of Object.entries(AUTOCOMPLETE_TO_FIELD)) {
  if (!FIELD_TO_AUTOCOMPLETE[fieldType]) {
    FIELD_TO_AUTOCOMPLETE[fieldType] = [];
  }
  FIELD_TO_AUTOCOMPLETE[fieldType].push(autocomplete);
}

/**
 * Get field type from autocomplete attribute value
 * @param {string} autocomplete - The autocomplete attribute value
 * @returns {string|null} Field type or null if not found
 */
function getFieldTypeFromAutocomplete(autocomplete) {
  if (!autocomplete) return null;

  // Handle section/billing/shipping prefixes (e.g., "shipping address-line1")
  const parts = autocomplete.toLowerCase().trim().split(/\s+/);
  const fieldPart = parts[parts.length - 1]; // Get the last part

  return AUTOCOMPLETE_TO_FIELD[fieldPart] || null;
}

/**
 * Get autocomplete values for a field type
 * @param {string} fieldType - Internal field type
 * @returns {string[]} Array of valid autocomplete values
 */
function getAutocompleteForFieldType(fieldType) {
  return FIELD_TO_AUTOCOMPLETE[fieldType] || [];
}

/**
 * Check if an autocomplete value is valid/known
 * @param {string} autocomplete - The autocomplete value to check
 * @returns {boolean} Whether the value is recognized
 */
function isValidAutocomplete(autocomplete) {
  if (!autocomplete) return false;
  const parts = autocomplete.toLowerCase().trim().split(/\s+/);
  const fieldPart = parts[parts.length - 1];
  return fieldPart in AUTOCOMPLETE_TO_FIELD;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.JobTrackerAutocompleteMap = {
    AUTOCOMPLETE_TO_FIELD,
    FIELD_TO_AUTOCOMPLETE,
    getFieldTypeFromAutocomplete,
    getAutocompleteForFieldType,
    isValidAutocomplete
  };
}
