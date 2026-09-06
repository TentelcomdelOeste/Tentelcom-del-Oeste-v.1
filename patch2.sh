sed -i '68a \
  const handleConvertToProject = async (quote: Quote) => {\
    try {\
      const existing = await getProjectByQuoteId(quote.id.toString());\
      if (existing) {\
        alert(`Esta cotización ya está asociada al proyecto ${existing.id}.`);\
        return;\
      }\
      const isConfirmed = await confirm(`¿Desea convertir la cotización ${quote.id} en un nuevo proyecto?`, "Convertir a Proyecto", "Convertir", "Cancelar", "primary");\
      if (!isConfirmed) return;\
      const newProject = await convertQuoteToProject(quote, currentUser.name);\
      alert(`Proyecto ${newProject.id} creado exitosamente.`);\
    } catch (error: any) {\
      alert(error.message || "Error al convertir en proyecto");\
    }\
  };' modules/quotes/QuotesModule.tsx
