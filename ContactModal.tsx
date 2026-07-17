import React, { useState } from 'react';
import { FiX, FiMail, FiPhone, FiMapPin, FiMessageCircle } from 'react-icons/fi';
import { ActionButton, IconButton } from './design-system';
import { trackEvent } from './services/analyticsService';
import emailjs from '@emailjs/browser';

interface ContactModalProps {
  show: boolean;
  onClose: () => void;
}

const ContactModal: React.FC<ContactModalProps> = ({ show, onClose }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    correo: '',
    mensaje: ''
  });

  if (!show) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    trackEvent('form_submit', { form: 'contact' });

    emailjs.send(
      'service_653z5yy',
      'template_p1f81kq',
      {
        nombre: form.nombre,
        correo: form.correo,
        mensaje: form.mensaje
      },
      '6T9DHrwvl6HPhEMA0'
    )
    .then(() => {
      setIsSubmitting(false);
      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        setForm({ nombre: '', correo: '', mensaje: '' });
        onClose();
      }, 2000);
    })
    .catch((error) => {
      console.error('Error:', error);
      setIsSubmitting(false);
      alert('Error al enviar el mensaje');
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="bg-blue-900 text-white p-6 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight">Contacto</h2>
            <p className="text-blue-200 text-sm mt-1">Envíenos su consulta y le responderemos a la brevedad.</p>
          </div>
          <IconButton 
            onClick={onClose}
            icon={<FiX className="text-xl" />}
            variant="neutral"
            title="Cerrar"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          <div className="grid md:grid-cols-2 gap-8">
            
            {/* Contact Info */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-blue-950 uppercase tracking-tight border-b border-slate-100 pb-2">
                Información Directa
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <FiMapPin />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Dirección</p>
                    <p className="text-sm text-slate-700 font-medium">Ofibodegas Terrum, Río Segundo<br/>Alajuela, Costa Rica</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <FiPhone />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Teléfonos</p>
                    <a href="tel:83936595" className="block text-sm text-slate-700 font-medium hover:text-blue-600">8393-6595 (Diego B.)</a>
                    <a href="tel:83270245" className="block text-sm text-slate-700 font-medium hover:text-blue-600">8327-0245 (Jonathan E.)</a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <FiMail />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Correos</p>
                    <a href="mailto:dbenavides@tentelcom.com" className="block text-sm text-slate-700 font-medium hover:text-blue-600 break-all">dbenavides@tentelcom.com</a>
                    <a href="mailto:jenamorado@tentelcom.com" className="block text-sm text-slate-700 font-medium hover:text-blue-600 break-all">jenamorado@tentelcom.com</a>
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div>
              <h3 className="text-lg font-bold text-blue-950 uppercase tracking-tight border-b border-slate-100 pb-2 mb-6">
                Envíenos un Mensaje
              </h3>
              
              {submitSuccess ? (
                <div className="bg-emerald-50 text-emerald-700 p-6 rounded-2xl text-center border border-emerald-100 h-full flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <FiMessageCircle className="text-2xl" />
                  </div>
                  <h4 className="font-bold text-lg mb-2">¡Mensaje Enviado!</h4>
                  <p className="text-sm">Nos pondremos en contacto con usted muy pronto.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Nombre Completo</label>
                    <input 
                      type="text" 
                      name="nombre"
                      value={form.nombre}
                      onChange={(e) => setForm({...form, nombre: e.target.value})}
                      required
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                      placeholder="Ej. Juan Pérez"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Correo Electrónico</label>
                    <input 
                      type="email" 
                      name="correo"
                      value={form.correo}
                      onChange={(e) => setForm({...form, correo: e.target.value})}
                      required
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                      placeholder="ejemplo@empresa.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Mensaje</label>
                    <textarea 
                      name="mensaje"
                      value={form.mensaje}
                      onChange={(e) => setForm({...form, mensaje: e.target.value})}
                      required
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm resize-none"
                      placeholder="¿En qué podemos ayudarle?"
                    ></textarea>
                  </div>
                  <ActionButton 
                    type="submit"
                    disabled={isSubmitting}
                    label={isSubmitting ? 'Enviando...' : 'Enviar Mensaje'}
                    variant="primary"
                    fullWidth={true}
                  />
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactModal;
