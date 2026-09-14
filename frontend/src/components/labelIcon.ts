import {
  BadgeEuro,
  Handshake,
  Headset,
  ShoppingCart,
  Siren,
  Tags,
  UserRound,
  Users,
} from "lucide-react";
import type { Label } from "../types";

export function labelIcon(label: Label) {
  switch (label) {
    case "potential_customer":
      return ShoppingCart;
    case "existing_customer":
      return UserRound;
    case "acquisition":
      return Siren;
    case "support":
      return Headset;
    case "partner":
      return Handshake;
    case "finance":
      return BadgeEuro;
    case "spam":
      return Tags;
    default:
      return Users;
  }
}
