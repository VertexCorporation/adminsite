# joining-date invocation verification

On October 11, 2026, the user explicitly approved adding allUsers to roles/run.invoker for only the setvertexcontributorjoiningdate Cloud Run service in vertex-ai-1618/europe-west1.

The policy was applied successfully. A safe anonymous callable request returned HTTP 401 UNAUTHENTICATED, confirming that requests now reach Firebase authentication rather than failing with the platform HTML 403. The serving revision remains setvertexcontributorjoiningdate-00001-jat. No production record, notification or certificate issuance was changed or triggered. The previous policy is retained in the backend workspace for rollback.

This verifies backend invocation transport and anonymous rejection. It does not verify authenticated production writes or the current ZIP replacement frontend. Earlier browser results belong to the prior console reconstruction and must not be treated as validation of the replacement commit c6a28eb.
