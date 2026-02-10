"use client"

import * as React from "react"
import { Card, CardContent } from "./card"
import { Badge } from "./badge" 
import { Button } from "./button"
import { Calendar, MapPin, Users, Clock, Star } from "lucide-react"
import { motion } from "framer-motion"

export interface EventCardProps {
  event: {
    id: string
    name: string
    description: string
    image: string
    date: string
    time: string
    venue: string
    location: string
    price: number
    currency?: string
    attendees: number
    capacity: number
    status: "active" | "sold_out" | "canceled" | "upcoming"
    rating?: number
    category: string
    organizer: {
      name: string
      avatar?: string
    }
  }
  onViewDetails?: (eventId: string) => void
  onBuyTicket?: (eventId: string) => void
  className?: string
}

const statusConfig = {
  active: { variant: "success" as const, label: "Disponible" },
  sold_out: { variant: "secondary" as const, label: "Agotado" },
  canceled: { variant: "error" as const, label: "Cancelado" },
  upcoming: { variant: "info" as const, label: "Próximamente" },
}

export function EventCard({ 
  event, 
  onViewDetails, 
  onBuyTicket,
  className = "" 
}: EventCardProps) {
  const statusInfo = statusConfig[event.status]
  const availableSpots = event.capacity - event.attendees
  const isNearCapacity = availableSpots <= event.capacity * 0.1 // 10% o menos disponible

  return (
    <motion.div
      whileHover={{ 
        y: -8, 
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15)" 
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={className}
    >
      <Card className="overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 bg-white dark:bg-gray-900">
        {/* Imagen del evento */}
        <div className="relative h-48 w-full overflow-hidden">
          <img 
            src={event.image} 
            alt={event.name}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          />
          
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          
          {/* Status badge */}
          <Badge 
            variant={statusInfo.variant}
            className="absolute top-3 right-3 shadow-lg"
          >
            {statusInfo.label}
          </Badge>
          
          {/* Category badge */}
          <Badge 
            variant="secondary"
            className="absolute top-3 left-3 bg-white/90 text-gray-900 border-0"
          >
            {event.category}
          </Badge>
          
          {/* Price overlay */}
          <div className="absolute bottom-3 right-3">
            <div className="bg-white/95 dark:bg-gray-900/95 px-3 py-1 rounded-full shadow-lg">
              <span className="text-lg font-bold text-purple-600">
                {event.currency || 'S/'} {event.price.toFixed(0)}
              </span>
            </div>
          </div>
        </div>
        
        <CardContent className="p-6">
          {/* Header con título y rating */}
          <div className="mb-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-bold text-xl text-gray-900 dark:text-white line-clamp-2 flex-1">
                {event.name}
              </h3>
              {event.rating && (
                <div className="flex items-center ml-3">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="text-sm font-medium text-gray-600 ml-1">
                    {event.rating}
                  </span>
                </div>
              )}
            </div>
            
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed line-clamp-2">
              {event.description}
            </p>
          </div>
          
          {/* Info del evento */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm">
              <Calendar className="w-4 h-4 mr-3 text-purple-500" />
              <span className="font-medium">{event.date}</span>
            </div>
            
            <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm">
              <Clock className="w-4 h-4 mr-3 text-purple-500" />
              <span>{event.time}</span>
            </div>
            
            <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm">
              <MapPin className="w-4 h-4 mr-3 text-purple-500" />
              <span className="truncate">{event.venue} • {event.location}</span>
            </div>
            
            <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm">
              <Users className="w-4 h-4 mr-3 text-purple-500" />
              <span>
                {event.attendees} asistentes • {availableSpots} disponibles
              </span>
              {isNearCapacity && (
                <Badge variant="warning" className="ml-2 text-xs">
                  ¡Últimos cupos!
                </Badge>
              )}
            </div>
          </div>
          
          {/* Organizador */}
          <div className="flex items-center pb-4 mb-4 border-b border-gray-100 dark:border-gray-700">
            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mr-3">
              {event.organizer.avatar ? (
                <img 
                  src={event.organizer.avatar} 
                  alt={event.organizer.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-purple-600 text-xs font-semibold">
                  {event.organizer.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Organizado por</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {event.organizer.name}
              </p>
            </div>
          </div>
          
          {/* Botones de acción */}
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => onViewDetails?.(event.id)}
            >
              Ver detalles
            </Button>
            
            <Button 
              variant="primary" 
              size="sm" 
              className="flex-1 shadow-lg"
              onClick={() => onBuyTicket?.(event.id)}
              disabled={event.status === "sold_out" || event.status === "canceled"}
            >
              {event.status === "sold_out" ? "Agotado" : 
               event.status === "canceled" ? "Cancelado" : 
               "Comprar entrada"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// Grid de eventos
export interface EventGridProps {
  events: EventCardProps["event"][]
  onViewDetails?: (eventId: string) => void
  onBuyTicket?: (eventId: string) => void
  className?: string
}

export function EventGrid({ events, onViewDetails, onBuyTicket, className = "" }: EventGridProps) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          onViewDetails={onViewDetails}
          onBuyTicket={onBuyTicket}
        />
      ))}
    </div>
  )
}