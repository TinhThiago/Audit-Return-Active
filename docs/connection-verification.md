# Connection verification — 07/10/2026

- CLI @microsoft/power-apps-cli 1.2.0, SDK @microsoft/power-apps 1.5.0.
- Existing CLI signed-in account; init and push succeeded in environment bdded998-c7e6-e6a3-b58a-58112acc2c9a.
- RetrieveAuditDetails and RetrieveMetadataChanges discovered by CLI from live Dataverse metadata; generated official services available.
- Existing Entra connection Dataverse Audit Lookup - PH verified: BaseResourceUrl and Token:ResourceUri both https://phuochung1.crm5.dynamics.com.
- Initial generic HTTP addition was rejected by auto-review. After read-only checks proved the exact destination of the existing connection, adding that specific Dataverse connection was approved. No broader connection was created.
- Runtime transport selected: official SDK connector InvokeHttp, allowing metadata/lookup/audit and If-Match PATCH without provisioning every business table.
- User explicitly approved clicking Allow in the Power Apps consent dialog on 07/10/2026.
- Live app loaded 837 table definitions via this connection; connector response decoded successfully. No direct token manipulation, secret storage or anonymous gateway.
- Second-user connection/permissions not verified; administrators must validate own-user connections before wider sharing.
