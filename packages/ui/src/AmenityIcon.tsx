/**
 * Shared amenity-icon renderer. The `icon` value (stored in the DB) can be:
 *   1. A Lucide icon name string  →  render the matching Lucide SVG (e.g. "Cctv")
 *   2. An HTTP/HTTPS URL          →  render an <img> (custom upload)
 *   3. Anything else              →  render as emoji/text (legacy fallback)
 *   4. Empty / missing            →  render nothing
 */
import {
  Cctv, ShieldCheck, SquareParking, Zap, Accessibility, ShowerHead,
  Lightbulb, ConciergeBell, WashingMachine, Banknote, Umbrella,
  BatteryCharging, Wrench, Wifi, Clock, Lock, Camera, Phone,
  Star, Wind, Building2, Sun, Leaf, Coffee, Waves, Fan, Flame,
  Timer, Moon, Navigation, Car, Bike, Truck,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

type LucideFC = React.ComponentType<LucideProps>;

/** Registry — icon name (string stored in DB) → Lucide component. */
export const LUCIDE_ICON_MAP: Record<string, LucideFC> = {
  Cctv, ShieldCheck, SquareParking, Zap, Accessibility, ShowerHead,
  Lightbulb, ConciergeBell, WashingMachine, Banknote, Umbrella,
  BatteryCharging, Wrench, Wifi, Clock, Lock, Camera, Phone,
  Star, Wind, Building2, Sun, Leaf, Coffee, Waves, Fan, Flame,
  Timer, Moon, Navigation, Car, Bike, Truck,
  // Legacy aliases so old DB values still render
  Warehouse:     SquareParking,
  User:          ShowerHead,
  KeyRound:      ConciergeBell,
  Droplets:      WashingMachine,
  Landmark:      Banknote,
  Shield:        ShieldCheck,
  MapPin:        Navigation,
  ParkingCircle: SquareParking,
};

export interface AmenityIconProps {
  icon: string;
  className?: string;
}

export const AmenityIcon = ({ icon, className = 'h-5 w-5' }: AmenityIconProps) => {
  if (!icon) return null;
  // URL → custom uploaded image
  if (icon.startsWith('http')) {
    return <img src={icon} alt="" className={`${className} rounded object-contain`} />;
  }
  // Lucide icon name → render SVG component
  const Icon = LUCIDE_ICON_MAP[icon] as LucideFC | undefined;
  if (Icon) return <Icon className={className} />;
  // Fallback: emoji / legacy text
  return <span className="text-base leading-none">{icon}</span>;
};
