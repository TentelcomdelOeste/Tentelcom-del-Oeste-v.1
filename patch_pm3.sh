sed -i '130a \
      <ProjectFormModal \
        show={showModal}\
        onClose={() => setShowModal(false)}\
        onSave={(p) => {\
          setProjects([p, ...projects]);\
          setCurrentProject(p);\
        }}\
        currentUser={currentUser}\
      />' modules/project_management/ProjectManagementModule.tsx
