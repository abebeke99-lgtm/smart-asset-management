import { messages, translateMessage, translateNavigationLabel, translateStatus } from "./messages";

describe("central English and Amharic translations", () => {
  test("translates Department Head labels without changing their source route labels", () => {
    expect(translateNavigationLabel("am", "Tickets")).toBe("ቲኬቶች");
    expect(translateNavigationLabel("am", "Asset Requests")).toBe("የንብረት ጥያቄዎች");
  });

  test("translates known statuses and preserves unknown database values", () => {
    expect(translateStatus("am", "under-maintenance")).toBe("በጥገና ላይ");
    expect(translateStatus("am", "In-Progress")).toBe("በሂደት ላይ");
    expect(translateStatus("am", "Awaiting local review")).toBe("Awaiting local review");
  });

  test("keeps English and Amharic catalogs structurally aligned", () => {
    const missingTranslations = [];
    const visit = (english, amharic, path = '') => {
      Object.entries(english).forEach(([key, value]) => {
        const currentPath = path ? `${path}.${key}` : key;
        if (!(key in amharic)) {
          missingTranslations.push(currentPath);
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          visit(value, amharic[key] || {}, currentPath);
        }
      });
    };

    visit(messages.en, messages.am);
    expect(missingTranslations).toEqual([]);
  });

  test("uses English for missing Amharic keys and replaces named parameters", () => {
    expect(translateMessage('am', 'navigation.dashboard')).toBe('ዳሽቦርድ');
    expect(translateMessage('am', 'navigation.homepage', 'Home page')).toBe('Home page');
    expect(translateMessage('am', 'common.paginationRange', undefined, { start: 1, end: 10, total: 25 })).toBe('ከ25 ውስጥ 1–10 በማሳየት ላይ');
  });
});
