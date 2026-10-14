// Feature flags. A flag is true only when the backend capability actually exists.
const features = {
	importPreview: true, // POST /imports/jobs/:id/preview
	importCommit: true, // POST /imports/jobs/:id/commit (bounded batches, idempotent)
	excelImport: false, // needs a spreadsheet parser dependency (not yet approved)
	presentations: true,
};

export default features;
