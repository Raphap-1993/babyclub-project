import { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  glow?: boolean;
};

export function GradientButton({
  children,
  className = "",
  glow = true,
  ...props
}: Props) {
  return (
    <button
      {...props}
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-full px-5 py-2 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-[#a60c2f]/70 focus:ring-offset-2 focus:ring-offset-black ${
        glow ? "shadow-[0_10px_40px_-20px_#a60c2f]" : ""
      } ${className}`}
    >
      <span className="absolute inset-0 bg-gradient-to-r from-[#a60c2f] via-[#b10e35] to-[#6f0c25] opacity-95" />
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.15),transparent_35%)]" />
      <span className="relative">{children}</span>
    </button>
  );
}
