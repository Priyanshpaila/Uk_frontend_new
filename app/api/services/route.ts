import { NextResponse } from "next/server";

export async function GET() {
  const mock = [
    {
      id: "acid-reflux",
      name: "Acid Reflux",
      description: "Relief for heartburn and indigestion with clinically proven treatments.",
      priceFrom: 19,
      category: "Private Service",
      icon: "💊"
    },
    {
      id: "weight-loss",
      name: "Weight Management",
      description: "Clinically monitored weight loss plans designed by UK prescribers.",
      priceFrom: 49,
      category: "Weight Management",
      icon: "⚖️"
    },
    {
      id: "travel-vaccine",
      name: "Travel Vaccinations",
      description: "Stay protected with destination-specific vaccines and advice.",
      priceFrom: 35,
      category: "Vaccinations",
      icon: "✈️"
    },
    {
      id: "hpv-vaccine",
      name: "HPV Vaccine",
      description: "Help protect against HPV-related cancers with pharmacy-administered vaccines.",
      priceFrom: 120,
      category: "Vaccinations",
      icon: "🛡️"
    },
    {
      id: "vitamin-b12",
      name: "Vitamin B12 Injection",
      description: "Boost energy levels with a convenient in-pharmacy B12 injection service.",
      priceFrom: 30,
      category: "Wellbeing",
      icon: "💉"
    },
    {
      id: "private-flu",
      name: "Private Flu Jab",
      description: "Protect yourself and loved ones during flu season with a fast appointment.",
      priceFrom: 15,
      category: "Vaccinations",
      icon: "🦠"
    }
  ];

  return NextResponse.json({ data: mock });
}
