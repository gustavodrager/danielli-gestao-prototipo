import {
  Link as RouterLink,
  NavLink as RouterNavLink,
  type LinkProps,
  type NavLinkProps,
} from "react-router-dom";
import { useDemo } from "./demo-context";
import { withMonth } from "./months";
export function Link({ to, ...props }: LinkProps) {
  const { period } = useDemo();
  return (
    <RouterLink
      {...props}
      to={typeof to === "string" ? withMonth(to, period) : to}
    />
  );
}
export function NavLink({ to, ...props }: NavLinkProps) {
  const { period } = useDemo();
  return (
    <RouterNavLink
      {...props}
      to={typeof to === "string" ? withMonth(to, period) : to}
    />
  );
}
