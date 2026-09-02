/**
 * How long someone had been a member when a mail reached them.
 *
 * Shared by the fetch step, which buckets each mail as it arrives, and the
 * cohort analysis, which compares year-groups at equal tenure. One definition
 * so the two can never drift apart.
 */
export const TENURE_MONTH_BUCKETS = [
  { key: '0-2', label: 'Første 3 måneder', from: 0, to: 3 },
  { key: '3-5', label: '3.–6. måned', from: 3, to: 6 },
  { key: '6-11', label: '6.–12. måned', from: 6, to: 12 },
  { key: '12-23', label: '2. år', from: 12, to: 24 },
  { key: '24+', label: 'Efter 2 år', from: 24, to: 1e6 },
]

export const tenureBucketKey = (months) =>
  TENURE_MONTH_BUCKETS.find((b) => months >= b.from && months < b.to)?.key ?? '24+'
