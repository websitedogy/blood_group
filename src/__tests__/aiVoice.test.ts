import { describe, it, expect } from 'vitest';
import { aiVoiceService } from '../services/aiVoiceService';

describe('Gate 8: AI & Multilingual Voice SOS Tests', () => {
  it('extracts blood group and hospital from English voice transcript', async () => {
    const transcript = 'Emergency at Apollo Hospital need 2 units of B positive blood immediately';
    const res = await aiVoiceService.processVoiceInput(transcript, 'en');

    expect(res.success).toBe(true);
    expect(res.extractedData?.blood_group).toBe('B+');
    expect(res.extractedData?.units_needed).toBe(2);
    expect(res.extractedData?.hospital_name).toBe('Apollo Hospitals');
    expect(res.extractedData?.is_ai_extracted).toBe(true);
    expect(res.extractedData?.user_confirmed).toBe(false); // MANDATORY user confirmation required
  });

  it('extracts blood group and hospital from Telugu voice transcript', async () => {
    const transcript = 'గాంధీ ఆసుపత్రిలో పేషెంట్ కు 1 బాటిల్ O పాజిటివ్ రక్తం అత్యవసరం';
    const res = await aiVoiceService.processVoiceInput(transcript, 'te');

    expect(res.success).toBe(true);
    expect(res.extractedData?.blood_group).toBe('O+');
    expect(res.extractedData?.hospital_name).toBe('Gandhi Hospital');
  });

  it('detects unclear or too short audio transcripts', async () => {
    const res = await aiVoiceService.processVoiceInput('hi', 'en');
    expect(res.success).toBe(false);
    expect(res.unclearAudio).toBe(true);
  });

  it('identifies missing critical fields', async () => {
    const transcript = 'Need blood urgently in city center';
    const res = await aiVoiceService.processVoiceInput(transcript, 'en');

    expect(res.success).toBe(false);
    expect(res.missingFields).toContain('Blood Group');
    expect(res.missingFields).toContain('Hospital Name');
  });
});
