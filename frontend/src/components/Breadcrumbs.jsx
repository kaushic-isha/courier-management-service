import { Link, useNavigate } from "react-router-dom";

export default function Breadcrumbs({ items }) {
  const navigate = useNavigate();

  return (
    <div className="breadcrumb-block">
      <button type="button" className="back-nav-btn" onClick={() => navigate(-1)}>
        Back
      </button>

      <nav className="breadcrumb">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <span key={`${item.label}-${index}`}>
              {item.to && !isLast ? (
                <Link className="breadcrumb-link" to={item.to}>
                  {item.label}
                </Link>
              ) : (
                <span className="breadcrumb-current">{item.label}</span>
              )}
              {!isLast && <span className="breadcrumb-sep"> / </span>}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
