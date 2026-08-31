export default function LogoMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none">
        <g className="logo-lines">
          <path d="M11 8.5h11" />
          <path d="M8.5 12.5h17" />
          <path d="M7 16.5h21" />
          <path d="M7 24.5h21" />
          <path d="M8.5 28.5h17" />
          <path d="M11 32.5h11" />
        </g>
        <path className="logo-accent" d="M6.5 20.5h22" />
      </svg>
    </span>
  );
}
