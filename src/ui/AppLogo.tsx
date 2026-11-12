const iconUrl =
  import.meta.env.BASE_URL.replace(/\/?$/, "/") + "audit-icon.svg";

export function AppLogo({ size }: { size: number }) {
  return (
    <img className="app-logo" src={iconUrl} width={size} height={size} alt="" />
  );
}
