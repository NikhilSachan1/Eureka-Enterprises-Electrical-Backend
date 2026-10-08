import { AssetFileTypes } from '../constants/asset-masters.constants';

/**
 * Which asset file counts as the calibration certificate.
 *
 * Two ways a certificate gets onto an asset, and the report has to find both:
 *
 *  - the **Calibrate action** (`POST /assets/action`, `action: CALIBRATED`) writes a real
 *    `fileType = CALIBRATION_CERTIFICATE` row;
 *  - the **asset add/edit screen**, which is what people actually use, hardcodes every upload to
 *    `ASSET_IMAGE` and carries the meaning in the per-file `label` instead. The frontend sends
 *    "CALIBRATION" there.
 *
 * That second case is a defect `docs/asset-file-labels-spec.md` §9 recorded and deliberately left
 * open: per-file `fileType` was scoped out of that change, so the column has never been settable
 * from the screen the files come in through. On dev all ten calibration files are `ASSET_IMAGE`
 * with that label, and not one is a `CALIBRATION_CERTIFICATE` — matching on the type alone is why
 * the report said "not on file" for assets that plainly had one.
 *
 * Compared lowercased and trimmed because the label is free text on the API: the frontend sends a
 * constant, but dev already holds both "CALIBRATION" and "Calibration".
 *
 * Equality, not `LIKE '%calib%'` — a file labelled "Calibration Invoice" is not the certificate,
 * and an audit report is the wrong place to guess.
 *
 * Expects the file aliased as `af`.
 */
export const IS_CALIBRATION_CERTIFICATE = `(
  af."fileType" = '${AssetFileTypes.CALIBRATION_CERTIFICATE}'
  OR LOWER(TRIM(af."label")) = 'calibration'
)`;

/**
 * The certificate on an asset, latest first.
 *
 * `$1`-free: the caller supplies the asset predicate, because one site matches `am.id` inside a
 * larger report query and the other takes the id as a parameter. Keeping the ordering and the
 * `deletedAt` check here is what stops the report and the public "View Certificate" link ever
 * disagreeing about which file they mean.
 */
export const latestCalibrationCertificate = (assetCondition: string) => `
  SELECT af."fileKey"
    FROM assets_files af
   WHERE ${assetCondition}
     AND ${IS_CALIBRATION_CERTIFICATE}
     AND af."deletedAt" IS NULL
   ORDER BY af."createdAt" DESC
   LIMIT 1
`;
