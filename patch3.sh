sed -i '423a \
                {q.estado === "Aprobada" && (\
                    <IconButton\
                        icon={<FiFolderPlus size={16} />}\
                        onClick={() => handleConvertToProject(q)}\
                        variant="primary"\
                        title="Convertir a Proyecto"\
                        className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200"\
                    />\
                )}' modules/quotes/QuotesModule.tsx
