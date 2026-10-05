import { translateNavigationLabel, translateStatus } from "./messages";

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
});
