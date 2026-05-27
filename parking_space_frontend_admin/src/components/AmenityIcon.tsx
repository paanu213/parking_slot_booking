/**
 * Shared amenity icon renderer.
 * Handles three cases:
 *   - Empty / missing icon → renders nothing
 *   - URL string → renders an <img>
 *   - Lucide icon name (e.g. "Cctv") → renders the matching Lucide component
 *   - Anything else → renders the raw value (lets emoji "🚿" still work)
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

export const AmenityIcon = ({
  icon, className = 'h-5 w-5',
}: { icon: string; className?: string }) => {
  if (!icon) return null;
  if (icon.startsWith('http')) {
    return <img src={icon} alt="" className={`${className} rounded object-contain`} />;
  }
  const Icon = LUCIDE_ICON_MAP[icon] as LucideFC | undefined;
  if (Icon) return <Icon className={className} />;
  return <span className="leading-none text-base">{icon}</span>;
};
