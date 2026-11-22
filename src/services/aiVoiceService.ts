import { BloodGroup } from '../types/donor';
import { CreateEmergencyRequestParams } from '../types/emergency';
import { validateBloodGroup } from '../utils/validation';

export interface AiVoiceExtractionResult {
  success: boolean;
  language: 'te' | 'en';
  extractedData?: Partial<CreateEmergencyRequestParams>;
  unclearAudio?: boolean;
  missingFields?: string[];
  rawTranscript?: string;
  error?: string;
}

export const aiVoiceService = {
  /**
   * Process voice input in Telugu or English and extract emergency parameters.
   * Mandates human user verification prior to submission.
   */
  async processVoiceInput(
    audioTranscript: string,
    language: 'te' | 'en' = 'en'
  ): Promise<AiVoiceExtractionResult> {
    if (!audioTranscript || audioTranscript.trim().length < 5) {
      return {
        success: false,
        language,
        unclearAudio: true,
        error:
          language === 'te'
            ? 'ఆడియో స్పష్టంగా లేదు. దయచేసి వివరాలను స్పష్టంగా చెప్పండి.'
            : 'Audio was unclear or too short. Please speak clearly.',
      };
    }

    const text = audioTranscript.toLowerCase();

    // 1. Detect blood group
    let detectedBg: BloodGroup | undefined;
    const bgPatterns: Record<string, BloodGroup> = {
      'o positive': 'O+',
      'o+': 'O+',
      'o పాజిటివ్': 'O+',
      'o negative': 'O-',
      'o-': 'O-',
      'o నెగెటివ్': 'O-',
      'a positive': 'A+',
      'a+': 'A+',
      'a పాజిటివ్': 'A+',
      'a negative': 'A-',
      'a-': 'A-',
      'a నెగెటివ్': 'A-',
      'b positive': 'B+',
      'b+': 'B+',
      'b పాజిటివ్': 'B+',
      'b negative': 'B-',
      'b-': 'B-',
      'b నెగెటివ్': 'B-',
      'ab positive': 'AB+',
      'ab+': 'AB+',
      'ab పాజిటివ్': 'AB+',
      'ab negative': 'AB-',
      'ab-': 'AB-',
      'ab నెగెటివ్': 'AB-',
    };

    for (const [pattern, bg] of Object.entries(bgPatterns)) {
      if (text.includes(pattern)) {
        detectedBg = bg;
        break;
      }
    }

    // 2. Units extraction
    let unitsNeeded = 1;
    const unitsMatch = text.match(/(\d+)\s*(units|unit|బాటిల్స్|యూనిట్లు)/);
    if (unitsMatch) {
      const parsed = parseInt(unitsMatch[1], 10);
      if (parsed >= 1 && parsed <= 20) unitsNeeded = parsed;
    }

    // 3. Hospital extraction heuristics
    let detectedHospital: string | undefined;
    if (text.includes('apollo') || text.includes('అపోలో')) detectedHospital = 'Apollo Hospitals';
    else if (text.includes('gandhi') || text.includes('గాంధీ')) detectedHospital = 'Gandhi Hospital';
    else if (text.includes('osmania') || text.includes('ఉస్మానియా')) detectedHospital = 'Osmania General Hospital';
    else if (text.includes('yashoda') || text.includes('యశోద')) detectedHospital = 'Yashoda Hospital';

    const missingFields: string[] = [];
    if (!detectedBg || !validateBloodGroup(detectedBg).isValid) missingFields.push('Blood Group');
    if (!detectedHospital) missingFields.push('Hospital Name');

    return {
      success: missingFields.length === 0,
      language,
      rawTranscript: audioTranscript,
      missingFields: missingFields.length > 0 ? missingFields : undefined,
      extractedData: {
        blood_group: detectedBg || 'O+',
        units_needed: unitsNeeded,
        hospital_name: detectedHospital || '',
        hospital_address: 'Hyderabad, Telangana',
        is_ai_extracted: true,
        user_confirmed: false, // MANDATORY: User must explicitly confirm before submission!
      },
    };
  },
};
