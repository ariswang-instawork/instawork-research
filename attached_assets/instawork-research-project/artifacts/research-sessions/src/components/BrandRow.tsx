const LOGO_URL = `${import.meta.env.BASE_URL}instawork_logo.png`;

/** Instawork Research brand header — logo mark + single-line wordmark. */
export function BrandRow() {
  return (
    <div className="flex items-center gap-3 mt-3.5 mb-[30px]">
      <img
        src={LOGO_URL}
        alt="Instawork"
        className="w-12 h-12 rounded-[12px] shrink-0"
      />
      <div className="text-2xl font-bold leading-none">
        <span className="text-gray-900">Instawork</span>{" "}
        <span className="text-primary">Research</span>
      </div>
    </div>
  );
}
