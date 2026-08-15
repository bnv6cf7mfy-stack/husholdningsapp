import type { TomorrowWeather } from "@/features/calendar/types";

function dateKeyInOslo(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function getPrecipitation(entry: any) {
  return (
    entry?.data?.next_1_hours?.details?.precipitation_amount ??
    entry?.data?.next_6_hours?.details?.precipitation_amount ??
    entry?.data?.next_12_hours?.details?.precipitation_amount ??
    0
  );
}

function getSymbolCode(entry: any) {
  return (
    entry?.data?.next_1_hours?.summary?.symbol_code ??
    entry?.data?.next_6_hours?.summary?.symbol_code ??
    entry?.data?.next_12_hours?.summary?.symbol_code ??
    ""
  );
}

function getAirTemperature(entry: any) {
  return entry?.data?.instant?.details?.air_temperature;
}

export async function getTomorrowWeatherSummary(): Promise<TomorrowWeather> {
  // Bekkestua defaults
  const latitude = process.env.YR_LATITUDE ?? "59.9182";
  const longitude = process.env.YR_LONGITUDE ?? "10.5853";
  const locationLabel = process.env.YR_LOCATION_LABEL ?? "Bekkestua";
  const userAgent = process.env.YR_USER_AGENT?.trim();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = dateKeyInOslo(tomorrow);

  const fallback: TomorrowWeather = {
    source: "yr",
    tomorrowDate: tomorrowKey,
    locationLabel,
    isRainExpected: false,
    maxPrecipMm: 0,
    error: "Værdata utilgjengelig"
  };

  if (!userAgent) {
    return {
      ...fallback,
      error: "Sett YR_USER_AGENT i miljo for a aktivere Yr"
    };
  }

  try {
    const response = await fetch(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${latitude}&lon=${longitude}`,
      {
        headers: {
          "User-Agent": userAgent,
          Accept: "application/json"
        },
        next: { revalidate: 60 * 30 }
      }
    );

    if (!response.ok) {
      return {
        ...fallback,
        error:
          response.status === 403
            ? "Yr avviste foresporselen (403). Bruk en gyldig YR_USER_AGENT med kontaktinfo"
            : `Yr-feil (${response.status})`
      };
    }

    const data = await response.json();
    const timeseries = data?.properties?.timeseries ?? [];

    const tomorrowSlots = timeseries.filter((entry: any) => {
      const time = entry?.time;

      if (!time) {
        return false;
      }

      return dateKeyInOslo(new Date(time)) === tomorrowKey;
    });

    if (tomorrowSlots.length === 0) {
      return {
        ...fallback,
        error: "Ingen værpunkter for i morgen"
      };
    }

    let maxPrecipMm = 0;
    let rainSymbolSeen = false;
    let minTemp = Number.POSITIVE_INFINITY;
    let maxTemp = Number.NEGATIVE_INFINITY;
    const symbolCounts = new Map<string, number>();

    tomorrowSlots.forEach((entry: any) => {
      const precip = Number(getPrecipitation(entry) ?? 0);
      const symbol = String(getSymbolCode(entry) ?? "").toLowerCase();
      const temp = Number(getAirTemperature(entry));

      if (precip > maxPrecipMm) {
        maxPrecipMm = precip;
      }

      if (symbol.includes("rain")) {
        rainSymbolSeen = true;
      }

      if (!Number.isNaN(temp)) {
        if (temp < minTemp) {
          minTemp = temp;
        }

        if (temp > maxTemp) {
          maxTemp = temp;
        }
      }

      if (symbol) {
        symbolCounts.set(symbol, (symbolCounts.get(symbol) ?? 0) + 1);
      }
    });

    const isRainExpected = rainSymbolSeen || maxPrecipMm >= 0.2;

    const dominantSymbol =
      Array.from(symbolCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? undefined;

    return {
      source: "yr",
      tomorrowDate: tomorrowKey,
      locationLabel,
      isRainExpected,
      maxPrecipMm: Number(maxPrecipMm.toFixed(1)),
      symbolCode: dominantSymbol,
      minTempC: Number.isFinite(minTemp) ? Number(minTemp.toFixed(1)) : undefined,
      maxTempC: Number.isFinite(maxTemp) ? Number(maxTemp.toFixed(1)) : undefined
    };
  } catch {
    return fallback;
  }
}
