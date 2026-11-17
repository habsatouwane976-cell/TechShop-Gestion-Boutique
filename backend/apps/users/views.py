"""Vues pour l'authentification et la gestion des utilisateurs"""
import logging
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from django.contrib.auth import authenticate
from django.utils import timezone
from geopy.geocoders import Nominatim
from .models import User, ActivityLog
from .serializers import (
    UserSerializer, RegisterSerializer, LoginSerializer,
    ChangePasswordSerializer, ActivityLogSerializer, UserUpdateSerializer
)
from .permissions import IsAdmin, IsManager

logger = logging.getLogger('apps')


def get_client_ip(request):
    """Récupère l'IP du client"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0]
    return request.META.get('REMOTE_ADDR')


def log_activity(user, action, resource, resource_id=None, description='', ip=None):
    """Crée une entrée dans le journal d'activité"""
    try:
        ActivityLog.objects.create(
            user=user, action=action, resource=resource,
            resource_id=resource_id, description=description, ip_address=ip
        )
    except Exception as e:
        logger.error(f"Erreur log activité: {e}")


def reverse_geocode(lat, lon):
    """Convertit des coordonnées en adresse"""
    try:
        geolocator = Nominatim(user_agent="boutique-manager")
        location = geolocator.reverse(f"{lat}, {lon}", language='fr', timeout=5)
        return location.address if location else ''
    except Exception:
        return ''


class RegisterView(APIView):
    """Inscription d'un nouvel utilisateur (Admin uniquement)"""
    permission_classes = [IsAdmin]

    def post(self, request):
        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        log_activity(request.user, 'create', 'User', user.id,
                     f"Création utilisateur: {user.email}", get_client_ip(request))
        return Response({
            'user': UserSerializer(user).data,
            'message': 'Utilisateur créé avec succès.',
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """Connexion avec JWT et géolocalisation optionnelle"""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request):
        ser = LoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = authenticate(
            request,
            username=ser.validated_data['email'],
            password=ser.validated_data['password']
        )
        if not user:
            return Response(
                {'error': 'Email ou mot de passe incorrect.'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        if not user.is_active:
            return Response(
{"error": "Compte désactivé. Contactez l'administrateur."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Enregistrer la géolocalisation
        lat = ser.validated_data.get('latitude')
        lon = ser.validated_data.get('longitude')
        ip = get_client_ip(request)

        if lat and lon:
            user.latitude = lat
            user.longitude = lon
            user.location_address = reverse_geocode(lat, lon)

        user.last_login_ip = ip
        user.last_login = timezone.now()
        user.save(update_fields=['last_login', 'last_login_ip', 'latitude', 'longitude', 'location_address'])

        refresh = RefreshToken.for_user(user)
        log_activity(user, 'login', 'User', user.id, 'Connexion réussie', ip)

        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            'message': 'Connexion réussie.',
        })


class LogoutView(APIView):
    """Déconnexion et invalidation du token"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh = request.data.get('refresh')
            token = RefreshToken(refresh)
            token.blacklist()
            log_activity(request.user, 'logout', 'User', request.user.id,
                         'Déconnexion', get_client_ip(request))
            return Response({'message': 'Déconnexion réussie.'})
        except Exception:
            return Response(
                {'error': 'Token invalide.'},
                status=status.HTTP_400_BAD_REQUEST
            )


class MeView(APIView):
    """Profil de l'utilisateur connecté"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def put(self, request):
        ser = UserUpdateSerializer(request.user, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)

        # Mise à jour géolocalisation
        lat = request.data.get('latitude')
        lon = request.data.get('longitude')
        if lat and lon:
            address = reverse_geocode(lat, lon)
            request.data._mutable = True if hasattr(request.data, '_mutable') else None
            ser.validated_data['location_address'] = address

        ser.save()
        log_activity(request.user, 'update', 'User', request.user.id,
                     'Mise à jour profil', get_client_ip(request))
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    """Changement de mot de passe"""
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request):
        ser = ChangePasswordSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        if not request.user.check_password(ser.validated_data['old_password']):
            return Response(
                {'error': 'Ancien mot de passe incorrect.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        request.user.set_password(ser.validated_data['new_password'])
        request.user.save()
        log_activity(request.user, 'update', 'User', request.user.id,
                     'Changement de mot de passe', get_client_ip(request))
        return Response({'message': 'Mot de passe modifié avec succès.'})


class UserListView(generics.ListAPIView):
    """Liste des utilisateurs (Admin uniquement)"""
    queryset = User.objects.all().order_by('-created_at')
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]
    search_fields = ['email', 'first_name', 'last_name', 'phone']
    filterset_fields = ['role', 'is_active']


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Détail / Modification / Suppression d'un utilisateur"""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        log_activity(request.user, 'delete', 'User', user.id,
                     f"Suppression: {user.email}", get_client_ip(request))
        return super().destroy(request, *args, **kwargs)


class ActivityLogView(generics.ListAPIView):
    """Journal d'activité"""
    serializer_class = ActivityLogSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ['action', 'resource']
    search_fields = ['user__email', 'description']
    ordering = ['-created_at']

    def get_queryset(self):
        return ActivityLog.objects.select_related('user').all()


class GeolocateView(APIView):
    """Géolocalisation inverse - coordonnées vers adresse"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        lat = request.data.get('latitude')
        lon = request.data.get('longitude')
        if not lat or not lon:
            return Response({'error': 'Latitude et longitude requis.'}, status=400)
        address = reverse_geocode(lat, lon)
        return Response({'address': address, 'latitude': lat, 'longitude': lon})
