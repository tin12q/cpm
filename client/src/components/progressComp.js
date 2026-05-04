import PropTypes from "prop-types";
import "../css/progress.css";

const Progress = ({ text, text1, rootClassName }) => {
  const percent = Math.max(0, Math.min(100, Number.parseInt(text, 10) || 0));

  return (
    <div className={`progress-shell ${rootClassName}`.trim()}>
      <div className="progress-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {text1}
            </p>
            <p className="mt-1 text-3xl font-black text-slate-900">{percent}%</p>
          </div>
          <div className="h-16 w-16 rounded-full border-2 border-dashed border-slate-400 bg-[#fef9c3] shadow-[4px_4px_0_rgba(31,41,55,0.12)]" />
        </div>
        <div className="mt-4 progress-track">
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
};

Progress.defaultProps = {
  text: "50%",
  rootClassName: "",
  text1: "Tiến Độ",
};

Progress.propTypes = {
  text: PropTypes.string,
  rootClassName: PropTypes.string,
  text1: PropTypes.string,
};

export default Progress;
