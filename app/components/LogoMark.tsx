export default function LogoMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none">
        <path className="logo-d" fillRule="evenodd" d="M12 7h8.5C27.3 7 32 11.8 32 20s-4.7 13-11.5 13H12V7Zm6 6.2v13.6h2.2c3.7 0 5.8-2.3 5.8-6.8s-2.1-6.8-5.8-6.8H18Z" />
        <path className="logo-growth-shadow" d="m7.5 27 3.7-3.7 2.7 2.5 5.1-5.8" />
        <path className="logo-growth" d="m7.5 27 3.7-3.7 2.7 2.5 5.1-5.8m-3.4 0H19v3.4" />
      </svg>
    </span>
  );
}
