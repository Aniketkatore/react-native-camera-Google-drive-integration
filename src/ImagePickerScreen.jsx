import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Image, 
  StyleSheet, 
  TouchableOpacity, 
  Platform,
  PermissionsAndroid,
  Alert,
  Linking,
  BackHandler,
  ActivityIndicator,
  FlatList,
  Modal,
  Dimensions
} from 'react-native';
import { 
  launchCamera, 
  launchImageLibrary,
  ImagePickerResponse
} from 'react-native-image-picker';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import axios from 'axios';

const { width, height } = Dimensions.get('window');

const ImagePickerScreen = () => {
  const [imageUri, setImageUri] = useState(null);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);
  const [storagePermissionGranted, setStoragePermissionGranted] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [selectedFromDrive, setSelectedFromDrive] = useState(false);
  const [imageSource, setImageSource] = useState(null);
  
  // New states for drive picker modal
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [driveImages, setDriveImages] = useState([]);
  const [loadingDriveImages, setLoadingDriveImages] = useState(false);

  useEffect(() => {
    // Check permissions when component mounts
    checkPermissions();
    
    // Configure Google Sign-In
    GoogleSignin.configure({
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.readonly'
      ],
      webClientId: '109648198808-9rqjd2aeee86jlnmvsnk61h46i1bgr49.apps.googleusercontent.com',
      offlineAccess: true,
    });
    
    // Check if already signed in
    checkSignInStatus();
    
    // Handle Android back button
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (showDriveModal) {
          setShowDriveModal(false);
          return true;
        }
        return false;
      }
    );

    return () => backHandler.remove();
  }, [showDriveModal]);

  const checkSignInStatus = async () => {
    try {
      const isSignedIn = await GoogleSignin.isSignedIn();
      setIsSignedIn(isSignedIn);
      
      if (isSignedIn) {
        const tokens = await GoogleSignin.getTokens();
        setAccessToken(tokens.accessToken);
      }
    } catch (error) {
      // console.error("Failed to check sign in status:", error);
    }
  };

  const signIn = async () => {
    try {
      setIsLoading(true);
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      console.log("Google Sign-In success:", userInfo);
      setIsSignedIn(true);
      
      const tokens = await GoogleSignin.getTokens();
      setAccessToken(tokens.accessToken);
      
      setIsLoading(false);
      return true;
    } catch (error) {
      setIsLoading(false);
      console.error("Google Sign-In Error:", error);
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert("Sign in cancelled");
      } else if (error.code === statusCodes.IN_PROGRESS) {
        Alert.alert("Sign in already in progress");
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert("Play services not available");
      } else {
        Alert.alert("Sign in error", error.toString());
      }
      return false;
    }
  };

  const checkPermissions = async () => {
    if (Platform.OS !== 'android') {
      setCameraPermissionGranted(true);
      setStoragePermissionGranted(true);
      return;
    }

    try {
      const cameraStatus = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      setCameraPermissionGranted(cameraStatus);
      
      if (parseInt(Platform.Version, 10) >= 33) {
        const mediaStatus = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
        );
        setStoragePermissionGranted(mediaStatus);
      } else {
        const readStatus = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
        );
        const writeStatus = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
        );
        setStoragePermissionGranted(readStatus && writeStatus);
      }
    } catch (err) {
      console.error("Permission check error:", err);
    }
  };

  const requestCameraPermission = async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: "Camera Permission",
          message: "App needs access to your camera",
          buttonNeutral: "Ask Me Later",
          buttonNegative: "Cancel",
          buttonPositive: "OK"
        }
      );
      
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        setCameraPermissionGranted(true);
        return true;
      } else {
        return false;
      }
    } catch (err) {
      console.error("Camera permission request error:", err);
      return false;
    }
  };

  const requestStoragePermission = async () => {
    try {
      let granted = false;
      
      if (parseInt(Platform.Version, 10) >= 33) {
        const status = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          {
            title: "Media Permission",
            message: "App needs access to your photos",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK"
          }
        );
        granted = status === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const readStatus = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: "Storage Read Permission",
            message: "App needs access to read your storage",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK"
          }
        );
        
        const writeStatus = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: "Storage Write Permission",
            message: "App needs access to write to your storage",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK"
          }
        );
        
        granted = 
          readStatus === PermissionsAndroid.RESULTS.GRANTED && 
          writeStatus === PermissionsAndroid.RESULTS.GRANTED;
      }
      
      if (granted) {
        setStoragePermissionGranted(true);
        return true;
      } else {
        return false;
      }
    } catch (err) {
      console.error("Storage permission request error:", err);
      return false;
    }
  };

  const ensurePermissions = async () => {
    let cameraPermission = cameraPermissionGranted;
    let storagePermission = storagePermissionGranted;
    
    if (!cameraPermission) {
      cameraPermission = await requestCameraPermission();
    }
    
    if (!storagePermission) {
      storagePermission = await requestStoragePermission();
    }
    
    return cameraPermission && storagePermission;
  };

  const openCamera = async () => {
    const hasPermissions = await ensurePermissions();
    if (!hasPermissions) {
      Alert.alert(
        "Permission Required",
        "Camera and storage permissions are required to take photos",
        [
          { text: "Cancel" },
          { 
            text: "Open Settings", 
            onPress: () => Linking.openSettings() 
          }
        ]
      );
      return;
    }
    
    try {
      setIsLoading(true);
      
      const options = {
        mediaType: 'photo',
        includeBase64: false,
        maxHeight: 800,
        maxWidth: 800,
        quality: 0.7,
        saveToPhotos: true,
        cameraType: 'back'
      };
      
      const result = await new Promise((resolve) => {
        launchCamera(options, (response) => {
          resolve(response);
        });
      });
      
      if (result.didCancel) {
        console.log('User cancelled camera');
      } else if (result.errorCode) {
        console.error('Camera error: ', result.errorMessage);
        Alert.alert("Camera Error", result.errorMessage || "Unknown error");
      } else if (result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
        setSelectedFromDrive(false);
        setImageSource('camera');
        
        Alert.alert(
          "Photo Captured!",
          "Would you like to save this photo to Google Drive?",
          [
            {
              text: "Not Now",
              style: "cancel"
            },
            {
              text: "Save to Drive",
              onPress: () => saveImageToDrive()
            }
          ]
        );
      }
    } catch (error) {
      console.error('Camera exception:', error);
      Alert.alert("Camera Error", `Failed to open camera: ${error.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const openGallery = async () => {
    const hasPermissions = await ensurePermissions();
    if (!hasPermissions) {
      Alert.alert(
        "Permission Required",
        "Storage permissions are required to select photos",
        [
          { text: "Cancel" },
          { 
            text: "Open Settings", 
            onPress: () => Linking.openSettings() 
          }
        ]
      );
      return;
    }
    
    try {
      setIsLoading(true);
      const options = {
        mediaType: 'photo',
        includeBase64: false,
        maxHeight: 800,
        maxWidth: 800,
        quality: 0.7,
        selectionLimit: 1
      };
      
      const result = await new Promise((resolve) => {
        launchImageLibrary(options, (response) => {
          resolve(response);
        });
      });
      
      if (result.didCancel) {
        console.log('User cancelled gallery');
      } else if (result.errorCode) {
        console.error('Gallery error: ', result.errorMessage);
        Alert.alert("Gallery Error", result.errorMessage || "Unknown error");
      } else if (result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
        setSelectedFromDrive(false);
        setImageSource('gallery');
      }
    } catch (error) {
      console.error('Gallery exception:', error);
      Alert.alert("Gallery Error", `Failed to open gallery: ${error.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteImage = () => {
    setImageUri(null);
    setSelectedFromDrive(false);
    setImageSource(null);
  };
  
  const getFileNameFromPath = (path) => {
    if (!path) return 'image.jpg';
    return path.substring(path.lastIndexOf('/') + 1);
  };
  
  const uriToBase64 = async (uri) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting URI to base64:', error);
      throw error;
    }
  };

  const findOrCreateAppFolder = async () => {
    const folderName = 'MyAppImages';
    
    try {
      if (!accessToken) {
        throw new Error('No access token available');
      }
      
      const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      const response = await axios.get('https://www.googleapis.com/drive/v3/files', {
        params: {
          q: query,
          spaces: 'drive',
          fields: 'files(id, name)'
        },
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      
      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id;
      }
      
      const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      };
      
      const createResponse = await axios.post(
        'https://www.googleapis.com/drive/v3/files',
        fileMetadata,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return createResponse.data.id;
    } catch (error) {
      throw error;
    }
  };
  
  const saveImageToDrive = async () => {
    if (!imageUri) {
      Alert.alert("No Image", "Please select or capture an image first");
      return;
    }
    
    try {
      setIsUploading(true);
      
      if (!isSignedIn) {
        const signedIn = await signIn();
        if (!signedIn) {
          setIsUploading(false);
          return;
        }
      }
      
      const folderId = await findOrCreateAppFolder();
      
      if (selectedFromDrive) {
        Alert.alert(
          "Information", 
          "This image is already stored in Google Drive",
          [{ text: "OK" }]
        );
        setIsUploading(false);
        return;
      }
      
      const fileName = getFileNameFromPath(imageUri);
      const base64Data = await uriToBase64(imageUri);
      const mimeType = fileName.toLowerCase().endsWith('.png') 
        ? 'image/png' 
        : 'image/jpeg';
      
      const metadata = {
        name: fileName,
        parents: [folderId]
      };
      
      const boundary = 'blob';
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delimiter = "\r\n--" + boundary + "--";
      
      let requestBody = 
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + mimeType + '\r\n' +
        'Content-Transfer-Encoding: base64\r\n' +
        '\r\n' +
        base64Data +
        close_delimiter;
      
      const response = await axios.post(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          }
        }
      );
      
      Alert.alert(
        "Success", 
        `Image saved to Google Drive in the "MyAppImages" folder`,
        [{ text: "OK" }]
      );
      
    } catch (error) {
      Alert.alert(
        "Upload Failed", 
        `Failed to save image: ${error.message || "Unknown error"}`,
        [{ text: "OK" }]
      );
    } finally {
      setIsUploading(false);
    }
  };

  // NEW: Load all images from Google Drive
  const loadDriveImages = async () => {
    try {
      setLoadingDriveImages(true);
      
      if (!accessToken) {
        throw new Error('No access token available');
      }
      
      // Find MyAppImages folder
      let folderFilter = "";
      try {
        const folderName = 'MyAppImages';
        const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        const response = await axios.get('https://www.googleapis.com/drive/v3/files', {
          params: {
            q: query,
            spaces: 'drive',
            fields: 'files(id, name)'
          },
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        
        if (response.data.files && response.data.files.length > 0) {
          folderFilter = `'${response.data.files[0].id}' in parents and `;
        }
      } catch (error) {
        console.log("Folder search error:", error);
      }
      
      // Query for ALL image files (removed the default limit of 10)
      const query = `${folderFilter}(mimeType = 'image/jpeg' or mimeType = 'image/png' or mimeType = 'image/gif' or mimeType = 'image/webp') and trashed = false`;
      const response = await axios.get('https://www.googleapis.com/drive/v3/files', {
        params: {
          q: query,
          spaces: 'drive',
          fields: 'files(id, name, mimeType, thumbnailLink, webContentLink, createdTime)',
          orderBy: 'createdTime desc',
          pageSize: 100  // Increase page size to get more images
        },
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      
      if (!response.data.files || response.data.files.length === 0) {
        setDriveImages([]);
        Alert.alert(
          "No Images Found", 
          "No images were found in your Google Drive MyAppImages folder.",
          [{ text: "OK" }]
        );
        return;
      }
      
      // Process images and get thumbnail URLs
      const processedImages = await Promise.all(
        response.data.files.map(async (file) => {
          let thumbnailUrl = null;
          
          // Try to get a thumbnail URL
          if (file.thumbnailLink) {
            // Use the provided thumbnail link
            thumbnailUrl = file.thumbnailLink.replace('=s220', '=s400'); // Increase thumbnail size
          } else {
            // If no thumbnail link, try to get a preview using the file ID
            try {
              thumbnailUrl = `https://lh3.googleusercontent.com/d/${file.id}=w400-h400-c`;
            } catch (error) {
              console.log("Error getting thumbnail for file:", file.name);
            }
          }
          
          return {
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            thumbnailUrl: thumbnailUrl,
            webContentLink: file.webContentLink
          };
        })
      );
      
      setDriveImages(processedImages);
      
    } catch (error) {
      console.error('Error loading drive images:', error);
      Alert.alert(
        "Error", 
        `Failed to load images: ${error.message || "Unknown error"}`,
        [{ text: "OK" }]
      );
    } finally {
      setLoadingDriveImages(false);
    }
  };

  // NEW: Select image from Google Drive with visual picker
  const selectFromGoogleDrive = async () => {
    try {
      if (!isSignedIn) {
        const signedIn = await signIn();
        if (!signedIn) {
          return;
        }
      }
      
      // Load images and show modal
      await loadDriveImages();
      setShowDriveModal(true);
      
    } catch (error) {
      console.error('Error opening Google Drive picker:', error);
      Alert.alert(
        "Error", 
        `Failed to open Google Drive: ${error.message || "Unknown error"}`,
        [{ text: "OK" }]
      );
    }
  };
  
  // NEW: Download and set selected image from Drive
  const selectDriveImage = async (fileId, fileName) => {
    try {
      setLoadingDriveImages(true);
      setShowDriveModal(false);
      
      // Get file content
      const response = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          responseType: 'blob'
        }
      );
      
      const blob = response.data;
      const reader = new FileReader();
      
      reader.onload = () => {
        const dataUri = reader.result;
        setImageUri(dataUri);
        setSelectedFromDrive(true);
        setImageSource('drive');
        setLoadingDriveImages(false);
      };
      
      reader.onerror = (error) => {
        console.error('Error reading blob:', error);
        Alert.alert("File Error", "Failed to load image");
        setLoadingDriveImages(false);
      };
      
      reader.readAsDataURL(blob);
      
    } catch (error) {
      console.error('Error downloading from Drive:', error);
      Alert.alert("Download Failed", `Failed to download image: ${error.message || "Unknown error"}`);
      setLoadingDriveImages(false);
    }
  };

  // NEW: Render individual drive image item
  const renderDriveImageItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.driveImageItem}
      onPress={() => selectDriveImage(item.id, item.name)}
    >
      <Image
        source={{ 
          uri: item.thumbnailUrl,
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }}
        style={styles.driveImageThumbnail}
        resizeMode="cover"
      />
      <Text style={styles.driveImageName} numberOfLines={2}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.button} 
        onPress={openCamera}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>📷 Take Photo</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={openGallery}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>🖼️ Choose from Gallery</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.button, styles.driveButton]} 
        onPress={selectFromGoogleDrive}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>☁️ Select from Google Drive</Text>
      </TouchableOpacity>
      
      {!cameraPermissionGranted || !storagePermissionGranted ? (
        <TouchableOpacity 
          style={[styles.button, styles.grantButton]} 
          onPress={ensurePermissions}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>🔐 Grant Permissions</Text>
        </TouchableOpacity>
      ) : null}
      
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}
      
      {imageUri ? (
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: imageUri }} 
            style={styles.image}
            resizeMode="contain" 
          />
          {selectedFromDrive && (
            <Text style={styles.sourceText}>📁 Image from Google Drive</Text>
          )}
          {imageSource === 'camera' && !selectedFromDrive && (
            <Text style={styles.sourceText}>📷 Photo from Camera</Text>
          )}
          {imageSource === 'gallery' && !selectedFromDrive && (
            <Text style={styles.sourceText}>🖼️ Image from Gallery</Text>
          )}
          
          {imageSource === 'camera' && !selectedFromDrive && (
            <TouchableOpacity 
              style={[styles.button, styles.prominentSaveButton]}
              onPress={saveImageToDrive}
              disabled={isLoading || isUploading}
            >
              <Text style={styles.buttonText}>
                {isUploading ? '📤 Uploading...' : '☁️ Save to Google Drive'}
              </Text>
            </TouchableOpacity>
          )}
          
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.button, styles.deleteButton]} 
              onPress={deleteImage}
              disabled={isLoading || isUploading}
            >
              <Text style={styles.buttonText}>🗑️ Delete</Text>
            </TouchableOpacity>
            
            {imageSource !== 'camera' && (
              <TouchableOpacity 
                style={[styles.button, styles.saveButton]}
                onPress={saveImageToDrive}
                disabled={isLoading || isUploading || selectedFromDrive}
              >
                <Text style={styles.buttonText}>
                  {isUploading ? '📤 Saving...' : '☁️ Save to Drive'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>📱 No image selected</Text>
          <Text style={styles.placeholderSubtext}>Take a photo or select from gallery</Text>
        </View>
      )}

      {/* NEW: Google Drive Image Picker Modal */}
      <Modal
        visible={showDriveModal}
        animationType="slide"
        onRequestClose={() => setShowDriveModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select from Google Drive</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowDriveModal(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          {loadingDriveImages ? (
            <View style={styles.modalLoadingContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={styles.loadingText}>Loading images...</Text>
            </View>
          ) : driveImages.length > 0 ? (
            <FlatList
              data={driveImages}
              renderItem={renderDriveImageItem}
              keyExtractor={(item) => item.id}
              numColumns={2}
              contentContainerStyle={styles.driveImagesList}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.noImagesContainer}>
              <Text style={styles.noImagesText}>No images found</Text>
              <Text style={styles.noImagesSubtext}>
                Upload some images to your MyAppImages folder first
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
    width: '80%',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 15,
  },
  grantButton: {
    backgroundColor: '#4CAF50',
  },
  driveButton: {
    backgroundColor: '#4285F4',
  },
  deleteButton: {
    backgroundColor: '#F44336',
    flex: 1,
    marginRight: 5,
  },
  saveButton: {
    backgroundColor: '#FF9800',
    flex: 1,
    marginLeft: 5,
  },
  prominentSaveButton: {
    backgroundColor: '#4CAF50',
    marginTop: 15,
    width: '90%',
    padding: 18,
    elevation: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    marginTop: 20,
    alignItems: 'center',
    width: '100%',
  },
  image: {
    width: 300,
    height: 300,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  placeholder: {
    width: 300,
    height: 200,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 18,
    color: '#757575',
    marginBottom: 10,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#9E9E9E',
  },
  sourceText: {
    marginTop: 10,
    color: '#555',
    fontSize: 14,
    fontStyle: 'italic',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingText: {
    color: '#FFF',
    marginTop: 10,
    fontSize: 16,
    fontWeight: '500',
  },
  // Drive modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#2196F3',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driveImagesList: {
    padding: 10,
  },
  driveImageItem: {
    width: (width - 40) / 2,
    margin: 5,
    backgroundColor: 'white',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  driveImageThumbnail: {
    width: '100%',
    height: 150,
    backgroundColor: '#e0e0e0',
  },
  driveImageName: {
    padding: 8,
    fontSize: 12,
    color: '#333',
  },
  noImagesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noImagesText: {
    fontSize: 18,
    color: '#757575',
    marginBottom: 10,
  },
  noImagesSubtext: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
  },
});

export default ImagePickerScreen;