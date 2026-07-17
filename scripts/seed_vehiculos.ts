import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export const seedVehiculosEnFirestore = async () => {
    const vehiculosCol = collection(db, 'vehiculos');
    
    // Vehículos extraídos de la bitácora actual
    const vehiculosExample = [
        {
            unidad: "U2",
            modelo: "MITSUBISHI L200",
            placa: "420101",
            activo: true,
            createdAt: serverTimestamp()
        },
        {
            unidad: "U4",
            modelo: "KIA MORNING",
            placa: "AAE-026",
            activo: true,
            createdAt: serverTimestamp()
        },
        {
            unidad: "U6",
            modelo: "HILUX",
            placa: "234567",
            activo: true,
            createdAt: serverTimestamp()
        },
        {
            unidad: "U7",
            modelo: "ISUZU DMAX",
            placa: "987654",
            activo: true,
            createdAt: serverTimestamp()
        }
    ];

    try {
        console.log("Iniciando creación de vehículos en la colección 'vehiculos'...");
        for (const v of vehiculosExample) {
            const docRef = await addDoc(vehiculosCol, v);
            console.log(`Vehículo ${v.unidad} agregado exitosamente con ID autogenerado: ${docRef.id}`);
        }
        console.log("✅ Creación de vehículos terminada.");
    } catch (error) {
        console.error("❌ Error al agregar vehículo:", error);
    }
};

/**
 * Función helper opcional para mapear un string viejo de unidadId a un objeto vehículo.
 * Para uso futuro en P2.
 */
export const parseUnidadIdToVehiculo = (unidadId: string) => {
    if (!unidadId) return null;
    const parts = unidadId.split(" - ");
    return {
        unidad: parts.length > 0 ? parts[0].trim() : "",
        modelo: parts.length > 1 ? parts[1].trim() : "",
        placa: parts.length > 2 ? parts[2].trim() : "",
    };
};
