sed -i '82a \
          <button\
            onClick={() => setShowModal(true)}\
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm"\
          >\
            <FiPlus />\
            <span>Nuevo Proyecto</span>\
          </button>' modules/project_management/ProjectManagementModule.tsx
