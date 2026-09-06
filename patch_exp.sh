sed -i 's/{project.quoteId || '\''N\/A'\''}/{(project.origin === "Cotización" \&\& project.quoteId) ? `#${project.quoteId}` : "N\/A"}/g' modules/project_management/ProjectExpediente.tsx
