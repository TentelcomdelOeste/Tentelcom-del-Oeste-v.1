
import React from 'react';

const AboutUsPage: React.FC = () => {
  return (
    <main className="animate-in fade-in duration-500">
      <section id="nosotros-page" className="py-24 px-6 bg-slate-50">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
             <span className="text-sm font-bold uppercase tracking-widest text-blue-500">Nuestra Empresa</span>
            <h2 className="text-4xl md:text-5xl font-black text-blue-950 mt-2 tracking-tighter">
              Quiénes Somos — Tentelcom del Oeste
            </h2>
          </div>
          <div className="bg-white p-10 md:p-12 rounded-3xl shadow-xl border border-slate-100 text-lg text-slate-600 space-y-6 text-justify">
            <p>
              Tentelcom del Oeste S.A. es una empresa costarricense especializada en el diseño, instalación y soporte de soluciones integrales de telecomunicaciones, orientadas tanto a clientes empresariales como residenciales. Desde San José, Costa Rica, brindamos servicios enfocados en cableado estructurado, redes de fibra óptica y asesoría técnica especializada, adaptados a las necesidades específicas de cada proyecto.
            </p>
            <p>
              Nos distinguimos por ofrecer un servicio profesional, confiable y personalizado, apoyado en el uso de tecnologías actuales y buenas prácticas del sector. Nuestro compromiso es garantizar infraestructuras de comunicación eficientes, seguras y escalables, que contribuyan al crecimiento y la continuidad operativa de nuestros clientes.
            </p>
            <p>
              En Tentelcom del Oeste trabajamos con un enfoque en la calidad, la mejora continua y la satisfacción del cliente, convirtiéndonos en un aliado estratégico para el desarrollo de proyectos de telecomunicaciones.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default AboutUsPage;
