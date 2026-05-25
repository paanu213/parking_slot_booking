/**
 * Shared amenity-icon renderer.
 *
 * Icon value (stored in DB) can be:
 *   1. A Lucide icon name string  →  render matching Lucide SVG  (e.g. "Cctv")
 *   2. An HTTP/HTTPS URL          →  render <img>                (custom upload)
 *   3. Anything else              →  render as emoji/text span   (legacy fallback)
 */
import {
  Cctv,
  ShieldCheck,
  SquareParking,
  Zap,
  Accessibility,
  ShowerHead,
  Lightbulb,
  ConciergeBell,
  WashingMachine,
  Banknote,
  Umbrella,
  BatteryCharging,
  Wrench,
  Wifi,
  Clock,
  Lock,
  Camera,
  Phone,
  Star,
  Wind,
  Building2,
  Sun,
  Leaf,
  Flame,
  Coffee,
  Waves,
  Fan,
  Timer,
  Moon,
  Navigation,
  // Vehicle type icons (keep in map for completeness)
  Car,
  Bike,
  Truck,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

type LucideFC = React.ComponentType<LucideProps>;

/** Registry — icon name (string stored in DB) → Lucide component */
export const LUCIDE_ICON_MAP: Record<string, LucideFC> = {
  // Core amenity icons
  Cctv,
  ShieldCheck,
  SquareParking,
  Zap,
  Accessibility,
  ShowerHead,
  Lightbulb,
  ConciergeBell,
  WashingMachine,
  Banknote,
  Umbrella,
  BatteryCharging,
  Wrench,
  Wifi,
  Clock,
  Lock,
  Camera,
  Phone,
  Star,
  Wind,
  Building2,
  Sun,
  Leaf,
  Flame,
  Coffee,
  Waves,
  Fan,
  Timer,
  Moon,
  Navigation,
  // Vehicle type icons
  Car,
  Bike,
  Truck,
  // Legacy / compatibility aliases
  Warehouse: SquareParking,
  User: ShowerHead,
  KeyRound: ConciergeBell,
  Droplets: WashingMachine,
  Landmark: Banknote,
  Shield: ShieldCheck,
  MapPin: Navigation,
  ParkingCircle: SquareParking,
};

export const AmenityIcon = ({
  icon,
  className = 'h-5 w-5',
}: {
  icon: string;
  className?: string;
}) => {
  if (!icon) return null;

  // URL → custom uploaded image
  if (icon.startsWith('http')) {
    return <img src={icon} alt="" className={`${className} rounded object-contain`} />;
  }

  // Lucide icon name → render SVG component
  const LucideIcon = LUCIDE_ICON_MAP[icon] as LucideFC | undefined;
  if (LucideIcon) return <LucideIcon className={className} />;

  // Fallback: emoji / legacy text
  return <span className="leading-none">{icon}</span>;
};
