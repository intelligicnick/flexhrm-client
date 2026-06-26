import { describe, expect, it } from 'vitest';
import {
  isAgentWindow,
  isBrowserProcess,
  isIgnorableWindow,
  resolveTrackedWebsite,
} from '../src/services/activity-filter';

describe('activity-filter', () => {
  it('detects agent windows', () => {
    expect(isAgentWindow('Flex HRM Connect', 'Setup')).toBe(true);
    expect(isAgentWindow('Google Chrome', 'Gmail')).toBe(false);
  });

  it('ignores system shells', () => {
    expect(isIgnorableWindow('Program Manager', 'Desktop')).toBe(true);
    expect(isIgnorableWindow('Google Chrome', 'Inbox - Gmail')).toBe(false);
  });

  it('detects browser processes', () => {
    expect(isBrowserProcess('Google Chrome')).toBe(true);
    expect(isBrowserProcess('WINWORD.EXE')).toBe(false);
  });

  it('extracts tracked website from browser window', () => {
    const url = resolveTrackedWebsite({
      appName: 'Google Chrome',
      windowTitle: 'FlexHRM - Google Chrome',
      processName: 'chrome.exe',
      url: 'https://app.flexhrm.example/dashboard',
    });
    expect(url).toBe('https://app.flexhrm.example/dashboard');
  });
});
