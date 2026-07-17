
/* eslint-disable no-restricted-syntax */
import React, { useState } from 'react';
import { trackEvent } from './services/analyticsService';
import ContactModal from './ContactModal';
import AboutUsPage from './AboutUsPage';

import { 
  LOGO_BASE64, 
  LOGO14_BASE64
} from './utils/logoBase64';
const cotizacionLogo = LOGO_BASE64;
const loginLogo = LOGO14_BASE64;
import { FiArrowLeft, FiShare2, FiArrowRight, FiActivity, FiCheck, FiMapPin, FiPhone, FiMessageCircle, FiMail, FiX, FiMenu, FiCpu, FiServer, FiGrid, FiShuffle, FiBox, FiClipboard, FiCheckCircle, FiBook } from "react-icons/fi";

interface PublicWebsiteProps {
  onEnterPortal: () => void;
}

// Tipos para las páginas de servicios
type PageView = 'home' | 'about' | 'service-cabling' | 'service-fiber' | 'service-certification';

interface ServiceItem {
  icon: React.ReactNode;
  title: string;
  description: string;
  detail?: string;
}

interface ServiceData {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  items: ServiceItem[];
}

// Datos de los Servicios (SEGÚN ESPECIFICACIÓN)
const SERVICES_DATA: Record<string, ServiceData> = {
  'service-cabling': {
    id: 'cabling',
    title: 'Cableado Estructurado',
    subtitle: 'Infraestructura confiable para entornos corporativos',
    description: 'Diseñamos, implementamos y suministramos soluciones de cableado estructurado en cobre para entornos empresariales, orientadas a garantizar orden, confiabilidad y continuidad operativa en redes de voz, datos y video.',
    items: [
      {
        icon: <FiCpu />,
        title: 'Cable UTP y Patch Cords',
        description: 'Suministro de cable UTP certificado y patch cords para interconexión de equipos.',
        detail: 'Cat 6 / Cat 6A'
      },
      {
        icon: <FiServer />,
        title: 'Organizadores de Cableado',
        description: 'Organizadores horizontales y verticales para gestión eficiente en racks y gabinetes.',
        detail: 'Orden y Ventilación'
      },
      {
        icon: <FiGrid />,
        title: 'Patch Panels',
        description: 'Soluciones de terminación estructurada de alta densidad para redes corporativas.',
        detail: 'Cumple normas TIA/EIA'
      }
    ]
  },
  'service-fiber': {
    id: 'fiber',
    title: 'Fibra Óptica',
    subtitle: 'Conectividad de alta capacidad para redes empresariales',
    description: 'Diseñamos, implementamos y comercializamos soluciones en fibra óptica monomodo y multimodo, enfocadas en proporcionar conectividad estable, segura y escalable para infraestructuras empresariales.',
    items: [
      {
        icon: <FiActivity />,
        title: 'Cable de Fibra Óptica',
        description: 'Fibra monomodo y multimodo para enlaces de alto desempeño.',
        detail: 'Interior / Exterior'
      },
      {
        icon: <FiShuffle />,
        title: 'Patch Cord de Fibra',
        description: 'Conectividad óptica de precisión con conectores SC y LC.',
        detail: 'Conectividad Óptica'
      },
      {
        icon: <FiBox />,
        title: 'Convertidores y ODF',
        description: 'Equipos de conversión de medios y distribución óptica organizada.',
        detail: 'Gestión de Fibra'
      }
    ]
  },
  'service-certification': {
    id: 'certification',
    title: 'Certificación de Redes',
    subtitle: 'Validación técnica bajo estándares internacionales',
    description: 'Realizamos certificación profesional de enlaces de cobre y fibra óptica mediante equipos FLUKE Networks calibrados, asegurando el cumplimiento de normas y estándares internacionales aplicables.',
    items: [
      {
        icon: <FiClipboard />,
        title: 'FLUKE DSX-8000',
        description: 'Certificación avanzada de enlaces de cobre hasta Cat 8.',
        detail: 'Equipo Calibrado'
      },
      {
        icon: <FiCheckCircle />,
        title: 'Certificación Óptica',
        description: 'Validación técnica de enlaces de fibra monomodo y multimodo.',
        detail: 'Tier 1 / Tier 2'
      },
      {
        icon: <FiBook />,
        title: 'Normativas Internacionales',
        description: 'Validación bajo estándares TIA/EIA e ISO/IEC.',
        detail: 'Cumplimiento Global'
      }
    ]
  }
};

// Componente Interno para Vista de Detalle de Servicio
const ServiceDetailView: React.FC<{ data: ServiceData; onBack: () => void; onContact: () => void }> = ({ data, onBack, onContact }) => {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white min-h-screen">
      {/* 1. ENCABEZADO (Hero Section) - Espaciado ajustado: pt-6 pb-6 */}
      <div className="bg-slate-50 pt-6 pb-6 px-6 border-b border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-grid-slate-200/[0.5] [mask-image:linear-gradient(to_bottom,white,transparent)] pointer-events-none"></div>
        <div className="container mx-auto relative z-10">
          <button 
            onClick={onBack} 
            className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors uppercase tracking-wider"
          >
            <FiArrowLeft  /> Volver a Servicios
          </button>
          {/* H1: mt-0 mb-2 */}
          <h2 className="text-4xl md:text-5xl font-black text-blue-950 tracking-tighter mt-0 mb-2 uppercase">
            {data.title}
          </h2>
          {/* Subtítulo: max-w-[720px], mt-0, mb-6, leading-relaxed */}
          <p className="text-xl text-slate-500 font-medium max-w-[720px] mt-0 mb-6 leading-relaxed">
            {data.subtitle}
          </p>
        </div>
      </div>

      {/* 2. SECCIÓN: Descripción del Servicio - Espaciado ajustado: py-6 */}
      <div className="container mx-auto py-6 px-6">
        <div className="max-w-[720px] mx-auto text-center">
          {/* Descripción: mt-0 mb-6 leading-relaxed */}
          <p className="text-lg md:text-xl text-slate-700 mt-0 mb-6 leading-relaxed font-medium">
            {data.description}
          </p>
          {/* Separador: mt-4 mb-6 */}
          <div className="mt-4 mb-6 w-24 h-1 bg-blue-600 mx-auto rounded-full"></div>
        </div>
      </div>

      {/* 3. SECCIÓN: Productos / Materiales / Equipos - Espaciado ajustado: py-6 */}
      <div className="bg-slate-50 py-6 px-6 border-t border-slate-100">
        <div className="container mx-auto">
          {/* Título: mt-0 mb-4 (16px) */}
          <h3 className="text-2xl font-black text-blue-950 uppercase tracking-tight mt-0 mb-4 text-center">
            {data.id === 'certification' ? 'Equipos y Capacidades' : 'Materiales y Equipos'}
          </h3>
          
          {/* Grid: gap-4 (16px), mb-6 (24px) */}
          <div className="grid md:grid-cols-3 gap-4 mb-6 max-w-6xl mx-auto">
            {data.items.map((item, idx) => (
              <div 
                key={idx} 
                className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 group"
              >
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  {item.icon}
                </div>
                <h4 className="text-lg font-black text-blue-950 mb-3 leading-tight min-h-[3rem] flex items-center">
                  {item.title}
                </h4>
                <p className="text-slate-600 text-sm mb-4 leading-relaxed h-10">
                  {item.description}
                </p>
                {item.detail && (
                  <div className="pt-4 border-t border-slate-50 mt-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {item.detail}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Botón: mt-4 (16px), mb-8 (32px) */}
          <div className="text-center mt-4 mb-8">
            <button 
              onClick={onContact} 
              className="bg-blue-900 text-white px-10 py-4 rounded-full font-bold uppercase text-sm shadow-xl hover:bg-blue-800 hover:scale-105 transition-all"
            >
              Solicitar Cotización
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PublicWebsite: React.FC<PublicWebsiteProps> = ({ onEnterPortal }) => {
  const [showContactModal, setShowContactModal] = useState(false);
  const [page, setPage] = useState<PageView>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Logos de clientes
  const clientLogos = [
    '/logos/logo1.png',
    '/logos/logo2.png',
    '/logos/logo3.png',
    '/logos/logo4.png',
    '/logos/logo5.png',
    '/logos/logo6.png',
    '/logos/logo7.png',
    '/logos/logo8.png',
    '/logos/logo9.png',
    '/logos/logo10.png',
    '/logos/logo11.png',
    '/logos/logo12.png'
  ];

  const navigateToHomeAndScroll = (targetId: string) => {
    setPage('home');
    setMobileMenuOpen(false);
    setTimeout(() => {
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 0);
  };

  const navigateToService = (servicePage: PageView) => {
    trackEvent('service_click', { service: servicePage });
    setPage(servicePage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Función para renderizar el contenido principal basado en el estado 'page'
  const renderMainContent = () => {
    switch (page) {
      case 'about':
        return <AboutUsPage />;
      case 'service-cabling':
        return <ServiceDetailView data={SERVICES_DATA['service-cabling']} onBack={() => setPage('home')} onContact={() => setShowContactModal(true)} />;
      case 'service-fiber':
        return <ServiceDetailView data={SERVICES_DATA['service-fiber']} onBack={() => setPage('home')} onContact={() => setShowContactModal(true)} />;
      case 'service-certification':
        return <ServiceDetailView data={SERVICES_DATA['service-certification']} onBack={() => setPage('home')} onContact={() => setShowContactModal(true)} />;
      case 'home':
      default:
        return (
          <main>
            {/* Hero Section */}
            <section id="inicio" className="relative text-center pt-16 pb-20 md:pt-24 md:pb-32 lg:pt-36 lg:pb-48 px-4 md:px-6 bg-slate-50 overflow-hidden">
              <div className="absolute inset-0 bg-grid-slate-200 [mask-image:linear-gradient(to_bottom,white,transparent)]"></div>
              <div className="relative container mx-auto z-10">
                <h2 className="text-3xl md:text-6xl lg:text-7xl font-black text-blue-950 mb-6 tracking-tighter leading-tight">
                  Conectividad de Alta Precisión para su Empresa
                </h2>
                <p className="max-w-3xl mx-auto text-base md:text-lg text-slate-600 mb-10">
                  Servicios integrales de instalación, certificación y mantenimiento de redes de fibra óptica y cableado estructurado. Aseguramos soluciones confiables y escalables que impulsan el crecimiento de su empresa.
                </p>
                <button onClick={() => setShowContactModal(true)} className="bg-blue-900 text-white px-8 md:px-12 py-4 md:py-5 rounded-full font-bold uppercase text-xs md:text-sm shadow-2xl shadow-blue-900/30 hover:scale-105 transition-all inline-block">
                  Contáctenos Ahora
                </button>
              </div>
            </section>

            {/* Services Section */}
            <section id="servicios" className="py-16 md:py-24 px-4 md:px-6 bg-white">
              <div className="container mx-auto">
                <div className="text-center mb-12 md:mb-16">
                  <span className="text-sm font-bold uppercase tracking-widest text-blue-500">Nuestros Servicios</span>
                  <h3 className="text-3xl md:text-4xl lg:text-5xl font-black text-blue-950 mt-2 tracking-tighter">Soluciones Integrales</h3>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10">
                  {/* Card 1: Cableado Estructurado */}
                  <div 
                    onClick={() => navigateToService('service-cabling')}
                    className="bg-slate-50 border border-slate-100 rounded-3xl p-8 md:p-10 text-center hover:shadow-xl hover:-translate-y-2 transition-all duration-300 cursor-pointer group"
                  >
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl md:text-3xl mx-auto mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors"><FiShare2  /></div>
                    <h4 className="text-xl font-black text-blue-950 mb-3">Cableado Estructurado</h4>
                    <p className="text-slate-500 text-sm md:text-base mb-4">Infraestructura de cableado corporativo diseñada para orden, confiabilidad y crecimiento operativo.</p>
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-widest group-hover:underline">Ver Detalles <FiArrowRight className="ml-1"  /></span>
                  </div>

                  {/* Card 2: Fibra Óptica */}
                  <div 
                    onClick={() => navigateToService('service-fiber')}
                    className="bg-slate-50 border border-slate-100 rounded-3xl p-8 md:p-10 text-center hover:shadow-xl hover:-translate-y-2 transition-all duration-300 cursor-pointer group"
                  >
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl md:text-3xl mx-auto mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors"><FiActivity  /></div>
                    <h4 className="text-xl font-black text-blue-950 mb-3">Fibra Óptica</h4>
                    <p className="text-slate-500 text-sm md:text-base mb-4">Soluciones en fibra óptica de alta capacidad para entornos empresariales que exigen velocidad y estabilidad.</p>
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-widest group-hover:underline">Ver Detalles <FiArrowRight className="ml-1"  /></span>
                  </div>

                  {/* Card 3: Certificación */}
                  <div 
                    onClick={() => navigateToService('service-certification')}
                    className="bg-slate-50 border border-slate-100 rounded-3xl p-8 md:p-10 text-center hover:shadow-xl hover:-translate-y-2 transition-all duration-300 cursor-pointer group"
                  >
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl md:text-3xl mx-auto mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors"><FiCheck  /></div>
                    <h4 className="text-xl font-black text-blue-950 mb-3">Certificación de Redes</h4>
                    <p className="text-slate-500 text-sm md:text-base mb-4">Certificación profesional de enlaces de cobre y fibra óptica bajo normas internacionales.</p>
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-widest group-hover:underline">Ver Detalles <FiArrowRight className="ml-1"  /></span>
                  </div>
                </div>
              </div>
            </section>

            {/* About Us Section */}
            <section id="nosotros" className="py-16 md:py-24 px-4 md:px-6 bg-blue-950 text-white">
              <div className="container mx-auto grid lg:grid-cols-2 gap-10 md:gap-16 items-center">
                <div>
                  <span className="text-sm font-bold uppercase tracking-widest text-blue-400">Quiénes Somos</span>
                  <h3 className="text-3xl md:text-4xl lg:text-5xl font-black mt-2 tracking-tighter mb-6">Comprometidos con la Calidad y la Eficiencia</h3>
                  <p className="text-blue-200 mb-4 text-sm md:text-base">
                    Con más de 20 años de experiencia en el sector de las telecomunicaciones, Tentelcom del Oeste se ha consolidado como un líder en la implementación de infraestructura de redes. Nuestro equipo de técnicos certificados está dedicado a entregar proyectos que no solo cumplen, sino que superan las expectativas de nuestros clientes.
                  </p>
                  <p className="text-blue-200 text-sm md:text-base">
                    Creemos en construir relaciones a largo plazo basadas en la confianza, la calidad de nuestro trabajo y un servicio al cliente excepcional.
                  </p>
                </div>
                <div className="flex flex-col items-center gap-8">
                    <div className="grid grid-cols-2 gap-4 md:gap-6 w-full">
                        <div className="bg-blue-900 p-6 md:p-8 rounded-3xl border border-blue-800 text-center md:text-left">
                            <span className="text-3xl md:text-5xl font-black text-blue-300">20+</span>
                            <p className="font-bold text-blue-400 mt-2 text-xs md:text-base">Años de Experiencia</p>
                        </div>
                         <div className="bg-blue-900 p-6 md:p-8 rounded-3xl border border-blue-800 text-center md:text-left">
                            <span className="text-3xl md:text-5xl font-black text-blue-300">1000+</span>
                            <p className="font-bold text-blue-400 mt-2 text-xs md:text-base">Proyectos Exitosos</p>
                        </div>
                    </div>
                </div>
              </div>
            </section>

            {/* INICIO BANNER CLIENTES */}
            <section className="py-16 md:py-20 bg-white overflow-hidden border-y border-slate-100">
              <div className="container mx-auto px-6 mb-10 text-center">
                <h3 className="text-xl md:text-2xl font-black text-blue-950 uppercase tracking-tighter">
                  Algunos clientes que han confiado en nosotros
                </h3>
              </div>
              
              <div className="relative flex overflow-x-hidden bg-slate-50/30 py-8 md:py-10">
                <div className="carousel-track">
                  {/* Primera vuelta de logos */}
                  {clientLogos.map((logo, idx) => (
                    <img 
                      key={`track1-${idx}`} 
                      src={logo} 
                      alt="Logo Empresa Cliente" 
                      className="client-logo-item" 
                    />
                  ))}
                  {/* Duplicación para efecto infinito */}
                  {clientLogos.map((logo, idx) => (
                    <img 
                      key={`track2-${idx}`} 
                      src={logo} 
                      alt="Logo Empresa Cliente" 
                      className="client-logo-item" 
                    />
                  ))}
                </div>
              </div>
            </section>
            {/* FIN BANNER CLIENTES */}

            {/* Contact Section */}
            <section id="contacto" className="py-16 md:py-24 px-4 md:px-6 bg-slate-50">
              <div className="container mx-auto text-center">
                <span className="text-sm font-bold uppercase tracking-widest text-blue-500">Contacto</span>
                <h3 className="text-3xl md:text-4xl lg:text-5xl font-black text-blue-950 mt-2 tracking-tighter mb-10">¿Listo para su Próximo Proyecto?</h3>
                <div className="max-w-lg mx-auto bg-white p-6 md:p-10 rounded-3xl shadow-xl border border-slate-100">
                   <p className="text-base md:text-lg text-slate-600 mb-2">Contáctenos para una cotización o asesoría en sus proyectos</p>
                   <a 
                     href="https://www.google.com/maps/search/?api=1&query=Tentelcom+del+Oeste+S.A.+Ofibodegas+Terrum+R%C3%ADo+Segundo+Costa+Rica" 
                     target="_blank" 
                     rel="noopener noreferrer" 
                     className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors mb-8 group"
                   >
                     <FiMapPin className="text-blue-500 group-hover:scale-110 transition-transform"  />
                     <span className="text-left">Dirección: San José - Alajuela, Río Segundo, Ofibodegas Terrum, Costa Rica</span>
                   </a>
                   <div className="space-y-6 text-left border-t border-slate-50 pt-8">
                      <div>
                          <p className="font-bold text-blue-950 text-base">Diego Benavides</p>
                          <div className="mt-2 space-y-2">
                              <div className="flex items-center gap-2">
                                  <a href="tel:83936595" className="font-bold text-blue-950 hover:text-blue-600 transition-colors flex items-center text-sm md:text-base">
                                      <FiPhone className="w-6 text-center mr-2 text-blue-500"  /> 
                                      8393-6595
                                  </a>
                                  <a href="https://wa.me/50683936595" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:text-emerald-600 transition-colors" title="WhatsApp Diego">
                                      <FiMessageCircle className="text-lg"  />
                                  </a>
                              </div>
                              <a href="mailto:dbenavides@tentelcom.com" className="font-bold text-blue-950 hover:text-blue-600 transition-colors flex items-center text-sm md:text-base break-all">
                                  <FiMail className="w-6 text-center mr-2 text-blue-500"  /> 
                                  dbenavides@tentelcom.com
                              </a>
                          </div>
                      </div>
                      <div>
                          <p className="font-bold text-blue-950 text-base">Jonathan Enamorado</p>
                          <div className="mt-2 space-y-2">
                              <div className="flex items-center gap-2">
                                  <a href="tel:83270245" className="font-bold text-blue-950 hover:text-blue-600 transition-colors flex items-center text-sm md:text-base">
                                      <FiPhone className="w-6 text-center mr-2 text-blue-500"  /> 
                                      8327-0245
                                  </a>
                                  <a href="https://wa.me/50683270245" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:text-emerald-600 transition-colors" title="WhatsApp Jonathan">
                                      <FiMessageCircle className="text-lg"  />
                                  </a>
                              </div>
                              <a href="mailto:jenamorado@tentelcom.com" className="font-bold text-blue-950 hover:text-blue-600 transition-colors flex items-center text-sm md:text-base break-all">
                                  <FiMail className="w-6 text-center mr-2 text-blue-500"  /> 
                                  jenamorado@tentelcom.com
                              </a>
                          </div>
                      </div>
                   </div>
                </div>
              </div>
            </section>
          </main>
        );
    }
  };

  return (
    <div className="bg-white text-slate-800">
      <style>{`
        @keyframes scrollInfinite {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .carousel-track {
          display: flex;
          width: max-content;
          animation: scrollInfinite 40s linear infinite;
        }
        .carousel-track:hover {
          animation-play-state: paused;
        }
        .client-logo-item {
          filter: grayscale(100%);
          opacity: 0.5;
          transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
          max-height: 84px;
          max-width: 192px;
          width: auto;
          object-fit: contain;
          margin: 0 45px;
        }
        .client-logo-item:hover {
          filter: grayscale(0%);
          opacity: 1;
          transform: scale(1.1);
        }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center relative">
          <div 
            className="flex items-center gap-3 cursor-pointer" 
            onClick={() => navigateToHomeAndScroll('inicio')}
          >
            <img 
              src={cotizacionLogo} 
              alt="Tentelcom Logo" 
              className="h-12 md:h-14 w-auto" 
            />
            <h1 className="text-2xl font-black text-blue-900 tracking-tighter uppercase">TENTELCOM</h1>
          </div>
          
          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-bold uppercase tracking-widest text-slate-500">
            <button onClick={() => navigateToHomeAndScroll('inicio')} className={`hover:text-blue-600 transition-colors ${page === 'home' ? 'text-blue-600' : ''}`}>INICIO</button>
            <button onClick={() => navigateToHomeAndScroll('servicios')} className={`hover:text-blue-600 transition-colors ${page.startsWith('service-') ? 'text-blue-600' : ''}`}>SERVICIOS</button>
            <button onClick={() => navigateToHomeAndScroll('nosotros')} className="hover:text-blue-600 transition-colors">NOSOTROS</button>
            <button onClick={() => navigateToHomeAndScroll('contacto')} className="hover:text-blue-600 transition-colors">CONTACTO</button>
          </nav>
          
          <div className="flex items-center gap-4">
             <button
                onClick={onEnterPortal}
                className="hidden md:flex items-center bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95"
              >
                Acceso
              </button>
              {/* Mobile Menu Toggle */}
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-blue-900 text-2xl">
                {mobileMenuOpen ? <FiX /> : <FiMenu />}
              </button>
          </div>
        </div>

        {/* Mobile Nav Dropdown */}
        {mobileMenuOpen && (
            <div className="md:hidden absolute top-full left-0 w-full bg-white border-b border-slate-100 shadow-xl py-4 px-6 flex flex-col gap-4 z-40 animate-in slide-in-from-top-2">
                <button onClick={() => navigateToHomeAndScroll('inicio')} className={`text-center font-bold uppercase tracking-widest text-sm py-2 ${page === 'home' ? 'text-blue-600' : 'text-slate-500'}`}>INICIO</button>
                <button onClick={() => navigateToHomeAndScroll('servicios')} className="text-center font-bold uppercase tracking-widest text-sm text-slate-500 py-2">SERVICIOS</button>
                <button onClick={() => navigateToHomeAndScroll('nosotros')} className="text-center font-bold uppercase tracking-widest text-sm text-slate-500 py-2">NOSOTROS</button>
                <button onClick={() => navigateToHomeAndScroll('contacto')} className="text-center font-bold uppercase tracking-widest text-sm text-slate-500 py-2">CONTACTO</button>
                <hr className="border-slate-100"/>
                <button
                    onClick={onEnterPortal}
                    className="bg-blue-600 text-white px-6 py-4 rounded-xl font-bold text-xs uppercase shadow-lg text-center"
                >
                    Acceso Corporativo
                </button>
            </div>
        )}
      </header>

      {renderMainContent()}

      {/* Footer */}
      <footer className="bg-blue-950 text-blue-300 py-8 px-6">
        <div className="container mx-auto text-center text-sm flex flex-col items-center gap-4">
          <img 
            src={loginLogo} 
            alt="Tentelcom Logo Footer" 
            className="h-12 w-auto" 
          />
          <p>&copy; {new Date().getFullYear()} TENTELCOM DEL OESTE S.A. Todos los derechos reservados.</p>
        </div>
      </footer>
      
      <ContactModal show={showContactModal} onClose={() => setShowContactModal(false)} />
    </div>
  );
};

export default PublicWebsite;
