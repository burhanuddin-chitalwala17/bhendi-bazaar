import { cn } from "@/lib/utils";
import { Icon, type IconProps } from "./icon";

/**
 * Work in progress inside a line of text ("Checking…"), where there is no button to be busy.
 * A busy button is `Button pending`; a loading page is a skeleton. Never a page-sized spinner.
 */
export function Spinner({ size = "sm", label, className }: Pick<IconProps, "size" | "label" | "className">) {
  return <Icon name="loading" size={size} label={label} className={cn("animate-spin motion-reduce:animate-none", className)} />;
}
