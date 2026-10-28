export interface Pair {
  start_time: string;
  forecast_publish_time: string | null;
  forecast_generation: number | null;
  actual_generation: number | null;
  error: number | null;
  absolute_error: number | null;
  eligible: boolean;
  cutoff_time: string;
  version_count: number;
  eligible_version_count: number;
}
export interface Version {
  start_time: string;
  publish_time: string;
  generation: number | null;
  actual_generation: number | null;
  error: number | null;
  absolute_error: number | null;
  eligible_under_policy: boolean;
  selected: boolean;
  cutoff_time: string;
}
export interface Summary {
  retrieved_at: string;
  source_mode: string;
  unit: string;
  forecast_policy: {
    description: string;
    cutoff: string;
    timezone: string;
    is_assumption: boolean;
  };
  counts: {
    expected_intervals: number;
    actual_records: number;
    forecast_records: number;
    forecast_delivery_intervals: number;
    matched_pairs: number;
    missing_actuals: number;
    missing_forecasts: number;
    no_eligible_forecast: number;
    null_selected_values: number;
  };
  metrics: {
    mean_forecast: number | null;
    mean_actual: number | null;
    mae: number | null;
    rmse: number | null;
    bias: number | null;
    mape: number | null;
    mape_pair_count: number;
    matched_pairs: number;
  };
  quality: Record<string, number>;
  provenance: {
    api_base: string;
    publication_window_start: string;
    publication_window_end_exclusive: string;
    retrieval: string;
    forecast_resolution: string;
    actual_resolution: string;
  };
  last_refresh_error: string | null;
}
export interface Dashboard {
  summary: Summary;
  timeseries: Pair[];
  errors: Pair[];
}
